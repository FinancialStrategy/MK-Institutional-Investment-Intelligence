from __future__ import annotations

import numpy as np
from scipy.optimize import least_squares


FLAT_TOL = 1e-6
SHAPE_PENALTY = 750.0


def _ns_basis(t: np.ndarray, tau: float) -> tuple[np.ndarray, np.ndarray]:
    x = np.maximum(t / max(tau, 1e-6), 1e-9)
    f1 = (1.0 - np.exp(-x)) / x
    f2 = f1 - np.exp(-x)
    return f1, f2


def nelson_siegel(t: np.ndarray, beta0: float, beta1: float, beta2: float, tau: float) -> np.ndarray:
    f1, f2 = _ns_basis(t, tau)
    return beta0 + beta1 * f1 + beta2 * f2


def svensson(
    t: np.ndarray,
    beta0: float,
    beta1: float,
    beta2: float,
    beta3: float,
    tau1: float,
    tau2: float,
) -> np.ndarray:
    f11, f12 = _ns_basis(t, tau1)
    _, f22 = _ns_basis(t, tau2)
    return beta0 + beta1 * f11 + beta2 * f12 + beta3 * f22


def _shape_class(yields: np.ndarray) -> str:
    if len(yields) < 2:
        return "insufficient_nodes"
    diffs = np.diff(yields)
    amplitude = float(np.ptp(yields))
    tol = max(FLAT_TOL, amplitude * 0.01)
    if amplitude <= tol:
        return "flat"
    nondecreasing = np.all(diffs >= -tol)
    nonincreasing = np.all(diffs <= tol)
    if nondecreasing and not nonincreasing:
        return "nondecreasing"
    if nonincreasing and not nondecreasing:
        return "nonincreasing"
    return "mixed"


def _shape_penalty(values: np.ndarray, shape: str) -> np.ndarray:
    """Return non-negative shape violations while keeping a fixed residual length."""
    diffs = np.diff(values)
    if shape == "nondecreasing":
        return np.maximum(-diffs, 0.0)
    if shape == "nonincreasing":
        return np.maximum(diffs, 0.0)
    if shape == "flat":
        return np.abs(diffs)
    return np.zeros_like(diffs)


def _fit_residuals(model, params: np.ndarray, years: np.ndarray, yields: np.ndarray, shape: str) -> np.ndarray:
    data_resid = model(years, *params) - yields
    # The shape penalty is applied only over the observed maturity horizon. This
    # keeps the fitted curve an actual Nelson-Siegel/Svensson function rather
    # than replacing it with a non-parametric line after fitting.
    grid = np.linspace(float(years.min()), float(years.max()), 160)
    model_vals = model(grid, *params)
    penalty = _shape_penalty(model_vals, shape) * SHAPE_PENALTY
    return np.concatenate([data_resid, penalty])


def _data_rmse(model, years: np.ndarray, yields: np.ndarray, params: np.ndarray) -> float:
    resid = model(years, *params) - yields
    return float(np.sqrt(np.mean(resid**2)))


def fit_ns(years: np.ndarray, yields: np.ndarray, shape: str | None = None) -> dict:
    shape = shape or _shape_class(yields)
    beta0 = float(yields[-1])
    x0 = np.array([beta0, float(yields[0] - beta0), 0.0, 1.5])
    b0_low = max(-0.25, float(np.min(yields)) - 0.20)
    b0_high = min(5.0, float(np.max(yields)) + 0.20)
    lower = np.array([b0_low, -5.0, -5.0, 0.05])
    upper = np.array([b0_high, 5.0, 5.0, 20.0])
    res = least_squares(
        lambda p: _fit_residuals(nelson_siegel, p, years, yields, shape),
        x0=x0,
        bounds=(lower, upper),
        max_nfev=30000,
    )
    return {
        "params": res.x.tolist(),
        "rmse": _data_rmse(nelson_siegel, years, yields, res.x),
        "shape": shape,
        "shape_constrained": shape in {"nondecreasing", "nonincreasing", "flat"},
        "display_name": "Nelson-Siegel",
    }


def fit_svensson(years: np.ndarray, yields: np.ndarray, shape: str | None = None) -> dict:
    shape = shape or _shape_class(yields)
    beta0 = float(yields[-1])
    x0 = np.array([beta0, float(yields[0] - beta0), 0.0, 0.0, 1.0, 4.0])
    b0_low = max(-0.25, float(np.min(yields)) - 0.20)
    b0_high = min(5.0, float(np.max(yields)) + 0.20)
    lower = np.array([b0_low, -5.0, -5.0, -5.0, 0.05, 0.05])
    upper = np.array([b0_high, 5.0, 5.0, 5.0, 20.0, 30.0])
    res = least_squares(
        lambda p: _fit_residuals(svensson, p, years, yields, shape),
        x0=x0,
        bounds=(lower, upper),
        max_nfev=50000,
    )
    return {
        "params": res.x.tolist(),
        "rmse": _data_rmse(svensson, years, yields, res.x),
        "shape": shape,
        "shape_constrained": shape in {"nondecreasing", "nonincreasing", "flat"},
        "display_name": "Svensson",
    }


def build_fitted_curve(days: list[int], yields: list[float]) -> dict:
    years = np.array(days, dtype=float) / 365.0
    y = np.array(yields, dtype=float)
    if len(years) < 4:
        return {"ns": None, "svensson": None, "grid": [], "shape": _shape_class(y)}

    # Ensure unique, sorted maturities before fitting.
    order = np.argsort(years)
    years = years[order]
    y = y[order]
    unique_years, unique_idx = np.unique(years, return_index=True)
    years = unique_years
    y = y[unique_idx]
    if len(years) < 4:
        return {"ns": None, "svensson": None, "grid": [], "shape": _shape_class(y)}

    shape = _shape_class(y)
    grid_years = np.linspace(max(1.0 / 365.0, float(years.min())), float(years.max()), 240)
    ns_fit = fit_ns(years, y, shape)
    ns_vals = nelson_siegel(grid_years, *ns_fit["params"])

    sv_fit = None
    sv_vals = None
    if len(years) >= 6:
        sv_fit = fit_svensson(years, y, shape)
        sv_vals = svensson(grid_years, *sv_fit["params"])

    grid = []
    for i, yr in enumerate(grid_years):
        row = {"years": float(yr), "days": int(round(yr * 365)), "ns": float(ns_vals[i])}
        if sv_vals is not None:
            row["svensson"] = float(sv_vals[i])
        grid.append(row)

    return {"ns": ns_fit, "svensson": sv_fit, "grid": grid, "shape": shape}
