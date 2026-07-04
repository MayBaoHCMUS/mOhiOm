db.createUser({
  user: "mohiom_user",
  pwd: "mohiom_password",
  roles: [
    {
      role: "readWrite",
      db: "mohiom_db",
    },
  ],
});

db.createCollection("items");

