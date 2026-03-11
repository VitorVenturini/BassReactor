function createDebugger(namespace = "") {
  const debug = (..._args) => {};
  debug.namespace = namespace;
  debug.enabled = false;
  debug.extend = (next) => createDebugger(`${namespace}:${next}`);
  debug.destroy = () => {};
  return debug;
}

createDebugger.enable = () => {};
createDebugger.disable = () => "";
createDebugger.enabled = () => false;
createDebugger.log = () => {};
createDebugger.humanize = (value) => String(value);
createDebugger.default = createDebugger;

export default createDebugger;
