const { handleRequest } = require('../src/server');

module.exports = async (req, res) => {
  await handleRequest(req, res, { serveStaticFiles: false });
};
