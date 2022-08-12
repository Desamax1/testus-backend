require("dotenv").config();
const express = require("express");
const bp = require("body-parser");
const app = express();
const path = require("path");
const crypto = require("crypto");
const db = require("better-sqlite3")("testus.db");
const fs = require("fs");

const pepper = process.env.PEPPER;

app.use(bp.json());
app.use(bp.urlencoded({extended: true}));

function genString(len = 30) {
    let string = "";
    for (let i = 0; i < len; i++) {
        let code;
        let broj = Math.floor(Math.random()*26);
        if (Math.round(Math.random())) {
            code = 'a'.charCodeAt(0);
        } else {
            code = 'A'.charCodeAt(0);
        }
        string += String.fromCharCode(code + broj);
    }
    return string;
}

app.post("/login", (req, res) => {
    try {
        if (req.body && req.body.email && req.body.password) {
            const { email, password } = req.body;
            const r = db.prepare(`SELECT salt, hash FROM Korisnici WHERE email='${email}'`).get();
            if (!r) {
                res.sendStatus(404);
                return;
            }
            const { salt, hash } = r;
            if (!salt || !hash) {
                res.sendStatus(400);
                return;
            }
            const userPw = pepper + password + salt;
            if (crypto.createHash("sha512").update(userPw).digest("base64") === hash) {
                // auth success
                const { id } = db.prepare(`SELECT id FROM Korisnici WHERE email='${email}'`).get();
                res.send(`${id}`);
            } else {
                // wrong pw or email
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(400);
        }
    } catch(e) {
        res.sendStatus(500);
        console.error(e);
    }
});

app.post("/register", (req, res) => {
    if (req.body && req.body.password && req.body.email && req.body.ime && req.body.prezime) {
        try {
            const { ime, prezime, password, email } = req.body;
            const salt = genString();
            const hash = crypto.createHash("sha512").update(pepper + password + salt).digest("base64");
            const { lastInsertRowid } = db.prepare(`INSERT INTO Korisnici(ime, prezime, email, hash, salt) VALUES ('${ime}', '${prezime}', '${email}', '${hash}', '${salt}')`).run();
            fs.copyFileSync(path.join(__dirname, "img", "default.jpg"), path.join(__dirname, "img", `${lastInsertRowid}.jpg`));
            res.sendStatus(200);
        } catch(e) {
            if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
                res.sendStatus(400);
            } else {
                res.sendStatus(500);
                console.error(e);
            }
        }
    } else {
        res.sendStatus(400);
    }
});

app.get("/user/info/:id", (req, res) => {
    const r = db.prepare(`SELECT ime, prezime FROM Korisnici WHERE id=${req.params.id}`).get();
    if (!r) {
        res.sendStatus(404);
        return;
    }
    res.json(r);
});

app.post("/api/zadaci", (req, res) => {
    const { oblast, broj, tezina } = req.body;
    
    res.sendStatus(200);
});

app.get("/user/img/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "img", `${req.params.id}.jpg`));
});
app.post("/user/img/:id", (req, res) => {
    console.log(req.headers, req.body);
    res.send("OK");
});

app.listen(8000, () => {
    console.log("Listening on http://localhost:8000/");
});