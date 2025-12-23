-- 001_init_schema.sql

CREATE TABLE IF NOT EXISTS warehousetask (
  wtid               SERIAL PRIMARY KEY,
  ewmwarehouse       VARCHAR(32) NOT NULL,
  warehouseorder     VARCHAR(32) NOT NULL,
  warehousetask      VARCHAR(32),
  warehousetaskitem  VARCHAR(32),
  sourcebin          VARCHAR(64) NOT NULL,
  destbin            VARCHAR(64) NOT NULL,
  createdat          TIMESTAMP NOT NULL DEFAULT NOW(),
  rawtext            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bininfo (
  bininfoid  SERIAL PRIMARY KEY,
  binname    VARCHAR(64) NOT NULL UNIQUE,
  locationx  NUMERIC(10,4),
  locationy  NUMERIC(10,4),
  createdat  TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedat  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS robot (
  robotid         INT PRIMARY KEY,
  name            VARCHAR(64),
  startlocationx  NUMERIC(10,4),
  startlocationy  NUMERIC(10,4),
  function        TEXT
);

CREATE TABLE IF NOT EXISTS robotlog (
  robotlogid  SERIAL PRIMARY KEY,
  robotid     INT REFERENCES robot(robotid),
  logtime     TIMESTAMP NOT NULL DEFAULT NOW(),
  loglevel    VARCHAR(16),
  message     TEXT,
  details     TEXT
);

CREATE TABLE IF NOT EXISTS floorplan (
  floorplanid  SERIAL PRIMARY KEY,
  name         VARCHAR(128) NOT NULL,
  version      VARCHAR(32) NOT NULL,
  sourcetype   VARCHAR(32) NOT NULL,
  jsonpath     VARCHAR(255),
  pgmpath      VARCHAR(255),
  yamlpath     VARCHAR(255),
  isdefault    BOOLEAN NOT NULL DEFAULT FALSE,
  createdat    TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marvintask (
  marvintaskid     SERIAL PRIMARY KEY,
  wtid             INT REFERENCES warehousetask(wtid),
  sourcebininfoid  INT REFERENCES bininfo(bininfoid),
  destbininfoid    INT REFERENCES bininfo(bininfoid),
  status           VARCHAR(32) NOT NULL,
  robotid          INT REFERENCES robot(robotid),
  createdat        TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedat        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasklog (
  tasklogid    SERIAL PRIMARY KEY,
  marvintaskid INT REFERENCES marvintask(marvintaskid),
  status       VARCHAR(32) NOT NULL,
  datetime     TIMESTAMP NOT NULL DEFAULT NOW(),
  robotlogid   INT REFERENCES robotlog(robotlogid),
  floorplanid  INT REFERENCES floorplan(floorplanid)
);
