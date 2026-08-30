const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createWorker } = require("tesseract.js");

const db = require("./database");

const app = express();


// ==================================================
// CP GOALS TABLES
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS goal_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        goal TEXT NOT NULL,
        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, goal)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS goal_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        goal TEXT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, goal)
    )
`);


// ==================================================
// CP POINTS
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS cp_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        points INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


// ==================================================
// WATCH ADS PROGRESS
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS ad_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        ads_watched INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


// ==================================================
// BUY CODE REWARD TRACKING
// ==================================================

try {

    db.exec(`
        ALTER TABLE cp_codes
        ADD COLUMN buycode_claimed INTEGER DEFAULT 0
    `);

    console.log(
        "Buy Code reward column added."
    );

}

catch (error) {

    if (
        !String(error.message).includes(
            "duplicate column name"
        )
    ) {

        console.error(
            "Buy Code column setup error:",
            error
        );

    }

}


// ==================================================
// BASIC SETUP
// ==================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ==================================================
// SESSIONS
// ==================================================

app.use(
    session({

        secret:
            "change-this-to-a-long-random-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            secure: false,

            maxAge:
                1000 * 60 * 60 * 24

        }

    })
);


// ==================================================
// LOGIN PROTECTION
// ==================================================

function requireLogin(req, res, next) {

    if (!req.session.userId) {

        return res.redirect(
            "/login.html"
        );

    }

    next();

}


// ==================================================
// PAYMENT PROOF DIRECTORY
// ==================================================

const proofFolder =
    path.join(
        __dirname,
        "payment-proofs"
    );

if (!fs.existsSync(proofFolder)) {

    fs.mkdirSync(
        proofFolder,
        {
            recursive: true
        }
    );

}


// ==================================================
// ALLOW PAYMENT-PROOF IMAGES TO BE SERVED
// ==================================================

app.use(
    "/payment-proofs",
    express.static(proofFolder)
);


// ==================================================
// MULTER IMAGE UPLOAD
// ==================================================

const storage =
    multer.diskStorage({

        destination:
            function(req, file, cb) {

                cb(
                    null,
                    proofFolder
                );

            },

        filename:
            function(req, file, cb) {

                const extension =
                    path.extname(
                        file.originalname
                    );

                const filename =
                    Date.now() +
                    "-" +
                    Math.floor(
                        Math.random() *
                        1000000
                    ) +
                    extension;

                cb(
                    null,
                    filename
                );

            }

    });


const upload =
    multer({

        storage: storage,

        limits: {

            fileSize:
                5 * 1024 * 1024

        },

        fileFilter:
            function(req, file, cb) {

                if (
                    file.mimetype &&
                    file.mimetype.startsWith(
                        "image/"
                    )
                ) {

                    cb(
                        null,
                        true
                    );

                }

                else {

                    cb(
                        new Error(
                            "Only image files are allowed."
                        )
                    );

                }

            }

    });


// ==================================================
// PUBLIC HOMEPAGE
// ==================================================
//
// IMPORTANT:
// The homepage does NOT require login.
//
// A visitor can open:
// /
// /cryptpay.html
//
// without being logged in.
//
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpay.html"
            )
        );

    }
);


app.get(
    "/cryptpay.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpay.html"
            )
        );

    }
);


// ==================================================
// PUBLIC LOGIN PAGE
// ==================================================

app.get(
    "/login.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "login.html"
            )
        );

    }
);


// ==================================================
// PUBLIC REGISTER PAGE
// ==================================================

app.get(
    "/register.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "register.html"
            )
        );

    }
);


// ==================================================
// PUBLIC ABOUT PAGE
// ==================================================

app.get(
    "/aboutcryptpay.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "aboutcryptpay.html"
            )
        );

    }
);


// ==================================================
// PUBLIC MORE PAGE
// ==================================================

app.get(
    "/cryptpaymore.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpaymore.html"
            )
        );

    }
);


// ==================================================
// PROTECTED PROFILE PAGE
// ==================================================

app.get(
    "/cryptpayprofile.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpayprofile.html"
            )
        );

    }
);


// ==================================================
// PROTECTED GOALS PAGE
// ==================================================

app.get(
    "/cryptpaygoals.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpaygoals.html"
            )
        );

    }
);


// ==================================================
// BACKWARD COMPATIBILITY FOR cpgoals.html
// ==================================================

app.get(
    "/cpgoals.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cpgoals.html"
            )
        );

    }
);


// ==================================================
// PROTECTED SHARE PAGE
// ==================================================

app.get(
    "/cryptpayshare.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpayshare.html"
            )
        );

    }
);


// ==================================================
// PROTECTED DAILY REWARD PAGE
// ==================================================

app.get(
    "/dailyrewardcryptpay.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "dailyrewardcryptpay.html"
            )
        );

    }
);


// ==================================================
// PROTECTED BALANCE PAGE
// ==================================================

app.get(
    "/cryptpaybalance.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpaybalance.html"
            )
        );

    }
);


// ==================================================
// PROTECTED WITHDRAW PAGE
// ==================================================

app.get(
    "/cryptpaywithdraw.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cryptpaywithdraw.html"
            )
        );

    }
);


// ==================================================
// PROTECTED BUY CODE PAGE
// ==================================================

app.get(
    "/buycodecryptpay.html",
    requireLogin,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "buycodecryptpay.html"
            )
        );

    }
);


// ==================================================
// REGISTER
// ==================================================

app.post(
    "/register",
    async (req, res) => {

        const {
            name,
            email,
            username,
            password
        } = req.body;

        if (
            !name ||
            !email ||
            !username ||
            !password
        ) {

            return res.json({

                success: false,

                message:
                    "Please fill in all fields."

            });

        }

        try {

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const result =
                db.prepare(`
                    INSERT INTO users
                    (
                        name,
                        email,
                        username,
                        password
                    )

                    VALUES (?, ?, ?, ?)
                `).run(

                    name,
                    email,
                    username,
                    hashedPassword

                );


            // Automatically log the newly
            // registered user in.

            req.session.userId =
                result.lastInsertRowid;


            res.json({

                success: true,

                message:
                    "Account created successfully."

            });

        }

        catch (error) {

            console.error(
                "Registration error:",
                error
            );

            res.json({

                success: false,

                message:
                    "That email or username may already be registered."

            });

        }

    }
);


// ==================================================
// LOGIN
// ==================================================

app.post(
    "/login",
    async (req, res) => {

        const {
            username,
            password
        } = req.body;

        try {

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE username = ?
                `).get(username);

            if (!user) {

                return res.json({

                    success: false,

                    message:
                        "Invalid username or password."

                });

            }

            const passwordCorrect =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordCorrect) {

                return res.json({

                    success: false,

                    message:
                        "Invalid username or password."

                });

            }

            req.session.userId =
                user.id;

            res.json({

                success: true

            });

        }

        catch (error) {

            console.error(
                "Login error:",
                error
            );

            res.json({

                success: false,

                message:
                    "Something went wrong."

            });

        }

    }
);


// ==================================================
// GET CURRENT USER
// ==================================================

app.get(
    "/me",
    (req, res) => {

        if (!req.session.userId) {

            return res.json({

                loggedIn: false

            });

        }

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    username,
                    balance

                FROM users

                WHERE id = ?
            `).get(
                req.session.userId
            );

        if (!user) {

            return res.json({

                loggedIn: false

            });

        }

        res.json({

            loggedIn: true,

            user: user

        });

    }
);


// ==================================================
// GET CP POINTS
// ==================================================

app.get(
    "/cp-points",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        try {

            const record =
                db.prepare(`
                    SELECT points
                    FROM cp_points
                    WHERE user_id = ?
                `).get(
                    req.session.userId
                );

            res.json({

                success: true,

                points:
                    record
                        ? record.points
                        : 0

            });

        }

        catch (error) {

            console.error(
                "CP points error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to get CP Points."

            });

        }

    }
);


// ==================================================
// UPDATE PROFILE
// ==================================================

app.put(
    "/profile",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "You must be logged in."

            });

        }

        const {
            name,
            email,
            username
        } = req.body;

        if (
            !name ||
            !email ||
            !username
        ) {

            return res.json({

                success: false,

                message:
                    "Please fill in all fields."

            });

        }

        try {

            db.prepare(`
                UPDATE users

                SET
                    name = ?,
                    email = ?,
                    username = ?

                WHERE id = ?
            `).run(

                name,
                email,
                username,
                req.session.userId

            );

            res.json({

                success: true

            });

        }

        catch (error) {

            console.error(
                "Profile error:",
                error
            );

            res.json({

                success: false,

                message:
                    "That email or username may already be in use."

            });

        }

    }
);


// ==================================================
// PAYMENT PROOF + OCR
// ==================================================

app.post(
    "/submit-payment-proof",

    upload.single("proof"),

    async (req, res) => {

        if (!req.session.userId) {

            if (req.file) {

                fs.unlink(
                    req.file.path,
                    () => {}
                );

            }

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        if (!req.file) {

            return res.json({

                success: false,

                message:
                    "Payment proof is required."

            });

        }

        try {

            console.log(
                "Starting OCR..."
            );

            const worker =
                await createWorker(
                    "eng"
                );

            const result =
                await worker.recognize(
                    req.file.path
                );

            const extractedText =
                result.data.text;

            console.log(
                "OCR TEXT:"
            );

            console.log(
                extractedText
            );

            await worker.terminate();


            const cleanedText =
                extractedText
                    .toUpperCase()
                    .replace(
                        /,/g,
                        ""
                    )
                    .replace(
                        /\s/g,
                        ""
                    )
                    .replace(
                        /₦/g,
                        ""
                    )
                    .replace(
                        /NGN/g,
                        ""
                    );


            console.log(
                "CLEANED OCR TEXT:"
            );

            console.log(
                cleanedText
            );


            const expectedAccountNumber =
                "7064985861";


            const accountNumberDetected =
                cleanedText.includes(
                    expectedAccountNumber
                );


            console.log(
                "Account number detected:",
                accountNumberDetected
            );


            if (
                !accountNumberDetected
            ) {

                fs.unlink(
                    req.file.path,
                    () => {}
                );

                return res.json({

                    success: false,

                    message:
                        "Transfer not received! try again"

                });

            }


            // ==================================================
            // GENERATE 8-CHARACTER CP CODE
            // ==================================================

            const characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

            let code;

            do {

                code = "";

                for (
                    let i = 0;
                    i < 8;
                    i++
                ) {

                    const randomIndex =
                        Math.floor(
                            Math.random() *
                            characters.length
                        );

                    code +=
                        characters[
                            randomIndex
                        ];

                }

            }

            while (

                db.prepare(`
                    SELECT id
                    FROM cp_codes
                    WHERE code = ?
                `).get(code)

            );


            const proofPath =
                "/payment-proofs/" +
                req.file.filename;


            db.prepare(`
                INSERT INTO cp_codes
                (
                    user_id,
                    code,
                    proof_path
                )

                VALUES (?, ?, ?)
            `).run(

                req.session.userId,

                code,

                proofPath

            );


            res.json({

                success: true,

                message:
                    "CryptPay payment proof accepted.",

                code: code

            });

        }

        catch (error) {

            console.error(
                "OCR error:",
                error
            );

            if (req.file) {

                fs.unlink(
                    req.file.path,
                    () => {}
                );

            }

            res.status(500).json({

                success: false,

                message:
                    "Request failed. Try again later."

            });

        }

    }
);


// ==================================================
// WITHDRAW
// ==================================================

app.post(
    "/withdraw",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        const {
            accountNumber,
            bank,
            amount,
            cpCode
        } = req.body;


        if (
            !accountNumber ||
            !bank ||
            !amount ||
            !cpCode
        ) {

            return res.json({

                success: false,

                message:
                    "Please fill in all fields."

            });

        }


        if (
            !/^\d{10}$/.test(
                accountNumber
            )
        ) {

            return res.json({

                success: false,

                message:
                    "Account number must contain exactly 10 digits."

            });

        }


        const withdrawalAmount =
            Number(amount);


        if (
            !Number.isFinite(
                withdrawalAmount
            ) ||
            withdrawalAmount <= 0
        ) {

            return res.json({

                success: false,

                message:
                    "Enter a valid amount."

            });

        }


        try {

            const user =
                db.prepare(`
                    SELECT balance
                    FROM users
                    WHERE id = ?
                `).get(
                    req.session.userId
                );


            if (!user) {

                return res.json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            if (
                withdrawalAmount >
                user.balance
            ) {

                return res.json({

                    success: false,

                    message:
                        "Insufficient balance."

                });

            }


            const codeRecord =
                db.prepare(`
                    SELECT id

                    FROM cp_codes

                    WHERE
                        user_id = ?

                        AND code = ?

                        AND used = 0
                `).get(

                    req.session.userId,

                    String(cpCode)
                        .toUpperCase()

                );


            if (!codeRecord) {

                return res.json({

                    success: false,

                    message:
                        "Invalid or already used CP-Code."

                });

            }


            db.prepare(`
                UPDATE users

                SET balance =
                    balance - ?

                WHERE id = ?
            `).run(

                withdrawalAmount,

                req.session.userId

            );


            db.prepare(`
                UPDATE cp_codes

                SET used = 1

                WHERE id = ?
            `).run(
                codeRecord.id
            );


            res.json({

                success: true,

                message:
                    "You will receive your funds shortly."

            });

        }

        catch (error) {

            console.error(
                "Withdrawal error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to process withdrawal."

            });

        }

    }
);


// ==================================================
// CLAIM DAILY REWARD
// ==================================================

app.post(
    "/claim-reward",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        const reward = 100000;

        try {

            const alreadyClaimed =
                db.prepare(`
                    SELECT id
                    FROM daily_claims
                    WHERE user_id = ?
                    AND date(claimed_at) = date('now')
                    LIMIT 1
                `).get(
                    req.session.userId
                );


            if (alreadyClaimed) {

                return res.json({

                    success: false,

                    message:
                        "You have already claimed today's reward. Come back tomorrow."

                });

            }


            const user =
                db.prepare(`
                    SELECT id, balance
                    FROM users
                    WHERE id = ?
                `).get(
                    req.session.userId
                );


            if (!user) {

                return res.json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            db.prepare(`
                UPDATE users

                SET balance =
                    balance + ?

                WHERE id = ?
            `).run(

                reward,

                req.session.userId

            );


            db.prepare(`
                INSERT INTO daily_claims
                (
                    user_id
                )

                VALUES (?)
            `).run(
                req.session.userId
            );


            res.json({

                success: true,

                message:
                    "You received NGN100,000"

            });

        }

        catch (error) {

            console.error(
                "Reward error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to claim reward."

            });

        }

    }
);


// ==================================================
// COMPLETE CP SHARE GOAL
// ==================================================

app.post(
    "/complete-share",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        try {

            const alreadyCompleted =
                db.prepare(`
                    SELECT id
                    FROM goal_completions
                    WHERE user_id = ?
                    AND goal = 'share'
                    LIMIT 1
                `).get(
                    req.session.userId
                );


            if (alreadyCompleted) {

                return res.json({

                    success: true,

                    message:
                        "Share goal already completed."

                });

            }


            db.prepare(`
                INSERT INTO goal_completions
                (
                    user_id,
                    goal
                )

                VALUES (?, 'share')
            `).run(
                req.session.userId
            );


            res.json({

                success: true,

                message:
                    "Share goal completed."

            });

        }

        catch (error) {

            console.error(
                "Share completion error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to record the share."

            });

        }

    }
);


// ==================================================
// AD PROGRESS
// ==================================================

app.get(
    "/ad-progress",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        try {

            const progress =
                db.prepare(`
                    SELECT ads_watched
                    FROM ad_progress
                    WHERE user_id = ?
                `).get(
                    req.session.userId
                );


            const adsWatched =
                progress
                    ? progress.ads_watched
                    : 0;


            const claimed =
                db.prepare(`
                    SELECT id
                    FROM goal_claims
                    WHERE user_id = ?
                    AND goal = 'watchads'
                    LIMIT 1
                `).get(
                    req.session.userId
                );


            res.json({

                success: true,

                adsWatched:
                    Math.min(
                        adsWatched,
                        2
                    ),

                required:
                    2,

                claimed:
                    !!claimed

            });

        }

        catch (error) {

            console.error(
                "Ad progress error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to check ad progress."

            });

        }

    }
);


// ==================================================
// CLAIM CP GOAL
// ==================================================

app.post(
    "/claim-goal",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }


        const { goal } =
            req.body;


        const rewards = {

            share: 50000,

            buycode: 50000

        };


        const validGoals = [

            "share",

            "buycode",

            "watchads"

        ];


        if (
            !validGoals.includes(
                goal
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid goal."

            });

        }


        try {


            // ==================================================
            // SHARE GOAL
            // ==================================================

            if (goal === "share") {

                const alreadyClaimed =
                    db.prepare(`
                        SELECT id
                        FROM goal_claims
                        WHERE user_id = ?
                        AND goal = 'share'
                        LIMIT 1
                    `).get(
                        req.session.userId
                    );


                if (alreadyClaimed) {

                    return res.json({

                        success: false,

                        message:
                            "You have already claimed this goal."

                    });

                }


                const shareCompleted =
                    db.prepare(`
                        SELECT id
                        FROM goal_completions
                        WHERE user_id = ?
                        AND goal = 'share'
                        LIMIT 1
                    `).get(
                        req.session.userId
                    );


                if (!shareCompleted) {

                    return res.json({

                        success: false,

                        message:
                            "You must complete the Share requirement before claiming this reward."

                    });

                }


                db.prepare(`
                    UPDATE users

                    SET balance =
                        balance + ?

                    WHERE id = ?
                `).run(

                    rewards.share,

                    req.session.userId

                );


                db.prepare(`
                    INSERT INTO goal_claims
                    (
                        user_id,
                        goal
                    )

                    VALUES (?, 'share')
                `).run(
                    req.session.userId
                );


                return res.json({

                    success: true,

                    message:
                        "Share goal claimed: NGN50,000"

                });

            }


            // ==================================================
            // BUY CODE GOAL
            // ==================================================

            if (goal === "buycode") {

                const availableCode =
                    db.prepare(`
                        SELECT
                            id,
                            code

                        FROM cp_codes

                        WHERE
                            user_id = ?

                            AND buycode_claimed = 0

                        ORDER BY id ASC

                        LIMIT 1
                    `).get(
                        req.session.userId
                    );


                if (!availableCode) {

                    return res.json({

                        success: false,

                        message:
                            "Please purchase CP code before claiming this reward."

                    });

                }


                db.prepare(`
                    UPDATE users

                    SET balance =
                        balance + ?

                    WHERE id = ?
                `).run(

                    rewards.buycode,

                    req.session.userId

                );


                db.prepare(`
                    UPDATE cp_codes

                    SET buycode_claimed = 1

                    WHERE id = ?
                `).run(
                    availableCode.id
                );


                return res.json({

                    success: true,

                    message:
                        "Buy Code goal claimed: NGN50,000"

                });

            }


            // ==================================================
            // WATCH ADS GOAL
            // ==================================================

            if (goal === "watchads") {

                const alreadyClaimed =
                    db.prepare(`
                        SELECT id
                        FROM goal_claims
                        WHERE user_id = ?
                        AND goal = ?
                        LIMIT 1
                    `).get(

                        req.session.userId,

                        goal

                    );


                if (alreadyClaimed) {

                    return res.json({

                        success: false,

                        message:
                            "You have already claimed this goal."

                    });

                }


                const progress =
                    db.prepare(`
                        SELECT ads_watched
                        FROM ad_progress
                        WHERE user_id = ?
                    `).get(
                        req.session.userId
                    );


                if (
                    !progress ||
                    progress.ads_watched < 2
                ) {

                    return res.json({

                        success: false,

                        message:
                            "You must complete 2 rewarded ads before claiming your CP Points."

                    });

                }


                db.prepare(`
                    INSERT INTO cp_points
                    (
                        user_id,
                        points
                    )

                    VALUES (?, 50000)

                    ON CONFLICT(user_id)

                    DO UPDATE SET
                        points =
                            points + 50000,

                        updated_at =
                            CURRENT_TIMESTAMP
                `).run(
                    req.session.userId
                );


                db.prepare(`
                    INSERT INTO goal_claims
                    (
                        user_id,
                        goal
                    )

                    VALUES (?, ?)
                `).run(

                    req.session.userId,

                    goal

                );


                return res.json({

                    success: true,

                    message:
                        "You received 50,000 CP Points."

                });

            }

        }

        catch (error) {

            console.error(
                "CP Goal error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to claim goal."

            });

        }

    }
);


// ==================================================
// GET CLAIMED CP GOALS
// ==================================================

app.get(
    "/claimed-goals",
    (req, res) => {

        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }

        try {

            const rows =
                db.prepare(`
                    SELECT goal
                    FROM goal_claims
                    WHERE user_id = ?
                `).all(
                    req.session.userId
                );


            const claimed =
                rows.map(
                    row => row.goal
                );


            res.json({

                success: true,

                claimed:
                    claimed

            });

        }

        catch (error) {

            console.error(
                "Claimed CP goals error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to check goals."

            });

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

app.post(
    "/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    return res.status(500).json({

                        success: false,

                        message:
                            "Unable to log out."

                    });

                }


                res.json({

                    success: true

                });

            }
        );

    }
);


// ==================================================
// STATIC FILES
// ==================================================
//
// This serves CSS, JavaScript, images, etc.
//
// HTML files are handled by the routes above,
// so protected HTML pages cannot bypass login.
//
// ==================================================

app.use(
    (req, res, next) => {

        const requestedPath =
            path.join(
                __dirname,
                req.path
            );


        const extension =
            path.extname(
                requestedPath
            ).toLowerCase();


        // Do not automatically serve HTML files.

        if (
            extension === ".html"
        ) {

            return next();

        }


        if (
            fs.existsSync(
                requestedPath
            ) &&
            fs.statSync(
                requestedPath
            ).isFile()
        ) {

            return res.sendFile(
                requestedPath
            );

        }


        next();

    }
);


// ==================================================
// 404
// ==================================================

app.use(
    (req, res) => {

        res.status(404).send(
            "Page not found."
        );

    }
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );


        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Image upload failed. Maximum file size is 5MB."

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Something went wrong."

        });

    }
);


// ==================================================
// START SERVER
// ==================================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "CryptPay is running on port:",
            PORT
        );

    }
);
