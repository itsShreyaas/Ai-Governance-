process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/aegisai?replicaSet=test";
process.env.JWT_ACCESS_SECRET = "a".repeat(64);
process.env.JWT_REFRESH_SECRET = "b".repeat(64);
process.env.CLIENT_ORIGIN = "http://localhost:5173";