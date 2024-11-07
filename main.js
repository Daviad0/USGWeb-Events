const express = require('express');

const app = express();

// hosting base url at usg.mtu.edu/events

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});