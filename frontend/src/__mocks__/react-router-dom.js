/**
 * Manual mock for react-router-dom so tests can run when the real module
 * fails to resolve (e.g. in some Jest/CRA environments).
 * Provides minimal implementations of MemoryRouter, Route, Routes, useParams, useNavigate.
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

function MemoryRouter({ children, initialEntries = ["/"] }) {
  const [index, setIndex] = React.useState(0);
  const entries = Array.isArray(initialEntries) ? initialEntries : [initialEntries];
  const pathname = (entries[index] || entries[0] || "/").split("?")[0];
  const navigate = React.useCallback(
    (to) => {
      if (typeof to === "number") setIndex((i) => Math.max(0, Math.min(entries.length - 1, i + to)));
      else {
        const idx = entries.indexOf(typeof to === "string" ? to : to?.pathname || "/");
        if (idx >= 0) setIndex(idx);
      }
    },
    [entries]
  );
  return React.createElement(
    NavigationContext.Provider,
    { value: { navigate } },
    React.createElement(LocationContext.Provider, { value: { pathname } }, children)
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
  return [new URLSearchParams(), () => {}];
}

module.exports = {
  useParams,
  useNavigate,
  useSearchParams,
  MemoryRouter,
  Route,
  Routes,
  Navigate: () => null,
  useLocation: () => ({ pathname: "/", search: "" }),
  Link: ({ to, children, ...p }) => React.createElement("a", { href: to, ...p }, children),
  BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
};