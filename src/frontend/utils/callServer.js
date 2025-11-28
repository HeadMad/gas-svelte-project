export default new Proxy({}, {
    get(_, func) {
      return (...args) => new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)[func](...args);
      });
    },
  });