const { withTransaction } = require("../infra/db");
const floorplanModel = require("../models/floorplanModel");

async function createOrUpdate(json) {
  return withTransaction(async (client) => floorplanModel.insertOrUpdate(client, json));
}

async function setDefault(floorplanId) {
  return withTransaction(async (client) => floorplanModel.setDefault(client, floorplanId));
}

async function getDefault() {
  return withTransaction(async (client) => floorplanModel.getDefault(client));
}

module.exports = { createOrUpdate, setDefault, getDefault };
