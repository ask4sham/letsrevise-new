/**
 * Manual mock for react-router-dom so tests can run when the real module
 * fails to resolve (e.g. in some Jest/CRA environments).
 * Provides minimal implementations of MemoryRouter, Route, Routes, useParams, useNavigate, useSearchParams.
 */
const React = require("react");

const NavigationContext = React.createContext({ navigate: () => {} });
const ParamsContext = React.createContext({});
const LocationContext = React.createContext({ pathname: "/", search: "" });

function useParams() {
  return React.useContext(ParamsContext) || {};
}

function useNavigate() {
  const { navigate } = React.useContext(NavigationContext) || {};
  return navigate || (() => {});
}

function entryToParts(entry) {
  if (entry && typeof entry === "object") {
    const pathname = entry.pathname || "/";
    let search = entry.search || "";
    if (search && !search.startsWith("?")) search = `?${search}`;
    return { pathname, search };
  }
  const raw = typeof entry === "string" ? entry : "/";
  const q = raw.indexOf("?");
  if (q < 0) return { pathname: raw || "/", search: "" };
  return { pathname: raw.slice(0, q) || "/", search: raw.slice(q) };
}

function MemoryRouter({ children, initialEntries = ["/"] }) {
  const [index, setIndex] = React.useState(0);
  const [overrideSearch, setOverrideSearch] = React.useState(null);
  const entries = React.useMemo(
    () => (Array.isArray(initialEntries) ? initialEntries : [initialEntries]),
    [initialEntries]
  );
  const parts = entryToParts(entries[index] || entries[0] || "/");
  const pathname = parts.pathname;
  const search = overrideSearch != null ? overrideSearch : parts.search;

  const navigate = React.useCallback(
    (to) => {
      if (typeof to === "number") setIndex((i) => Math.max(0, Math.min(entries.length - 1, i + to)));
      else {
        const target = typeof to === "string" ? to : to?.pathname || "/";
        const idx = entries.findIndex((e) => {
          const p = entryToParts(e);
          return p.pathname === target || e === to;
        });
        if (idx >= 0) {
          setOverrideSearch(null);
          setIndex(idx);
        }
      }
    },
    [entries]
  );

  const setSearchParams = React.useCallback((next, _opts) => {
    setOverrideSearch((prev) => {
      const current = new URLSearchParams(
        (prev != null ? prev : parts.search).replace(/^\?/, "")
      );
      let params;
      if (typeof next === "function") {
        params = next(current);
      } else if (next instanceof URLSearchParams) {
        params = next;
      } else {
        params = new URLSearchParams(next);
      }
      const s = params.toString();
      return s ? `?${s}` : "";
    });
  }, [parts.search]);

  return React.createElement(
    NavigationContext.Provider,
    { value: { navigate } },
    React.createElement(
      LocationContext.Provider,
      { value: { pathname, search, setSearchParams } },
      children
    )
  );
}

function Route({ path, element }) {
  const { pathname } = React.useContext(LocationContext) || {};
  const pattern = path.replace(/:[^/]+/g, "([^/]+)");
  const re = new RegExp("^" + pattern + "$");
  const match = pathname.match(re);
  if (!match) return null;
  const params = {};
  const keys = path.match(/:[^/]+/g) || [];
  keys.forEach((k, i) => {
    params[k.slice(1)] = match[i + 1];
  });
  return React.createElement(
    ParamsContext.Provider,
    { value: params },
    element
  );
}

function Routes({ children }) {
  const childArray = React.Children.toArray(children);
  const location = React.useContext(LocationContext) || {};
  const pathname = location.pathname || "/";
  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];
    if (child && child.props && child.props.path) {
      const pattern = "^" + child.props.path.replace(/:[^/]+/g, "([^/]+)") + "$";
      const match = pathname.match(new RegExp(pattern));
      if (match) {
        const keys = child.props.path.match(/:[^/]+/g) || [];
        const params = {};
        keys.forEach((k, ii) => {
          params[k.slice(1)] = match[ii + 1];
        });
        return React.createElement(ParamsContext.Provider, { value: params }, child.props.element);
      }
    }
  }
  return null;
}

function useSearchParams() {
  const location = React.useContext(LocationContext) || {};
  const search = location.search || "";
  const setSearchParams = location.setSearchParams || (() => {});
  return [new URLSearchParams(search.replace(/^\?/, "")), setSearchParams];
}

function useLocation() {
  const location = React.useContext(LocationContext) || {};
  return {
    pathname: location.pathname || "/",
    search: location.search || "",
  };
}

module.exports = {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
  MemoryRouter,
  Route,
  Routes,
  Navigate: () => null,
  Link: ({ to, children, ...p }) => React.createElement("a", { href: to, ...p }, children),
  BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
};
