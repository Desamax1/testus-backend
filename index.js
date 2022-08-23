require("dotenv").config();
const express = require("express");
const app = express();
const crypto = require("crypto");
const db = require("better-sqlite3")("testus.db");
const path = require("path");
const fs = require("fs");
const { error } = require("console");
const { rejects } = require("assert");

const pepper = process.env.PEPPER;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            db.prepare(`INSERT INTO Korisnici(ime, prezime, email, hash, salt) VALUES ('${ime}', '${prezime}', '${email}', '${hash}', '${salt}')`).run();
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
app.get("/user/img/:id", (req, res) => {
    try {
        res.setHeader("content-type", "image/webp");
        if (fs.existsSync(path.join(__dirname, "img", req.params.id))) {
            res.sendFile(path.join(__dirname, "img", req.params.id));
        } else {
            res.sendFile(path.join(__dirname, "img", "default"));
        }
    } catch (e) {
        res.sendStatus(404);
        console.error(e);
    }
});
app.post("/user/img/:id", (req, res) => {
    // TODO: dodati auth da ne bi bilo ko mogao da promeni avatara
    const { avatar } = req.body;
    if (avatar) {
        fs.writeFileSync(path.join(__dirname, "img", req.params.id), avatar, "base64");
        res.sendStatus(200);
    } else {
        res.sendStatus(400);
    }
});

function generateTest(oblast, broj, tezina, uid = null, pid = null) {
    // generisi listu u kojoj se nalaze zadaci koji ce biti na testu
    let testCount = 0;
    let s = "";
    for (let i = 0; i < oblast.length; i++) {
        const testsDb = db.prepare(`SELECT id, tekst, resenje FROM Zadaci WHERE idPodoblast = ${oblast[i]} AND tezina = ${tezina[i]} ORDER BY random() LIMIT ${broj[i]};`).all();
        if (testsDb.length > 0) {
            for (let j = 0; j < testsDb.length; j++) {
                testCount++;
                s += testsDb[j].tekst;
                if (j !== testsDb.length - 1) {
                    s += ';';
                }
            }
        } else {
            throw "Nema zadataka koji odgovaraju zadatom kriterijumu!";
        }
    }
    // u bazu upisi zadatke sa te liste - kreiraj test
    const { lastInsertRowid } = db.prepare(`INSERT INTO Testovi(zadCount,zadaci,idUcenika,idProfesora) VALUES (${testCount}, '${s}', ${uid}, ${pid});`).run();
    // vrati id tog testa
    return lastInsertRowid;
}
app.post("/test/", (req,res) => {
    let {oblast, broj, tezina} = req.query;
    if (typeof oblast === "string") {
        oblast = [oblast];
    }
    if (typeof broj === "string") {
        broj = [broj];
    }
    if (typeof tezina === "string") {
        tezina = [tezina];
    }
    if (oblast.length !== broj.length || oblast.length !== tezina.length || broj.length !== tezina.length) {
        res.sendStatus(400);
        return;
    }

    try {
        const zadaci = generateTest(oblast, broj, tezina);
        res.status(201).json(zadaci);
    } catch (e) {
        res.sendStatus(404);
        console.error(e);
    }
});
app.get("/test/", (req, res) => {
    try {
        const test = db.prepare(`SELECT zadCount, zadaci FROM Testovi WHERE id=${req.query.testId}`).get();
        if (test) {
            res.json(test);
        } else {
            res.sendStatus(404);
        }
    } catch (e) {
        res.sendStatus(400);
        console.error(e);
    }
});
app.get("/oblasti", (req, res) => {
    const { podoblast } = req.query;
    if (podoblast === undefined) {
        // vrati oblasti
        try {
            const po = db.prepare(`SELECT oblast FROM Oblasti WHERE podoblast IS NULL`).all();
            res.json(po);
        } catch (e) {
            res.sendStatus(400);
            console.error(e);
        }
    } else {
        // vrati podoblast
        try {
            const po = db.prepare(`SELECT oblast FROM Oblasti WHERE podoblast = ${podoblast}`).all();
            res.json(po);
        } catch (e) {
            res.sendStatus(400);
            console.error(e);
        }
    }
});

app.listen(8000, () => {
    console.log("Listening on http://localhost:8000/");
});