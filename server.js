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
// CP GOALS TABLE
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


// ==================================================
// CP SHARE COMPLETIONS TABLE
// ==================================================

db.exec(`
    CREATE TABLE IF NOT EXISTS share_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
    )
`);


// ==================================================
// BASIC SETUP
// ==================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.static("."));


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

                } else {

                    cb(
                        new Error(
                            "Only image files are allowed."
                        )
                    );

                }

            }

    });


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


            req.session.userId =
                result.lastInsertRowid;


            res.json({

                success: true

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

        // ------------------------------
        // CHECK LOGIN
        // ------------------------------

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


        // ------------------------------
        // CHECK IMAGE
        // ------------------------------

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


            // ==========================
            // OCR WORKER
            // ==========================

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


            // ==========================
            // CLEAN OCR TEXT
            // ==========================

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


            // ==================================================
            // EXPECTED PAYMENT DETAILS
            // ==================================================

            const expectedAccountNumber =
                "7064985861";


            // ==================================================
            // CHECK ACCOUNT NUMBER
            // ==================================================

            const accountNumberDetected =
                cleanedText.includes(
                    expectedAccountNumber
                );


            // ==================================================
            // LOG RESULTS
            // ==================================================

            console.log(
                "Account number detected:",
                accountNumberDetected
            );


            // ==================================================
            // REQUIRE ACCOUNT NUMBER
            // ==================================================

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


            // ==================================================
            // SAVE CP CODE
            // ==================================================

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


            // ==================================================
            // SUCCESS
            // ==================================================

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


        // ==========================
        // CHECK FIELDS
        // ==========================

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


        // ==========================
        // CHECK ACCOUNT NUMBER
        // ==========================

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


        // ==========================
        // CHECK AMOUNT
        // ==========================

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

            // ==========================
            // GET USER
            // ==========================

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


            // ==========================
            // CHECK BALANCE
            // ==========================

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


            // ==========================
            // CHECK CP CODE
            // ==========================

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


            // ==========================
            // DEDUCT BALANCE
            // ==========================

            db.prepare(`
                UPDATE users

                SET balance =
                    balance - ?

                WHERE id = ?
            `).run(

                withdrawalAmount,

                req.session.userId

            );


            // ==========================
            // MARK CODE USED
            // ==========================

            db.prepare(`
                UPDATE cp_codes

                SET used = 1

                WHERE id = ?
            `).run(
                codeRecord.id
            );


            // ==========================
            // SUCCESS
            // ==========================

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

        // Check if the user is logged in
        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }


        const reward = 100000;


        try {

            // ========================================
            // CHECK WHETHER USER ALREADY CLAIMED TODAY
            // ========================================

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


            // ========================================
            // FIND CURRENT USER
            // ========================================

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


            // ========================================
            // ADD REWARD TO BALANCE
            // ========================================

            db.prepare(`
                UPDATE users

                SET balance =
                    balance + ?

                WHERE id = ?
            `).run(

                reward,

                req.session.userId

            );


            // ========================================
            // RECORD TODAY'S CLAIM
            // ========================================

            db.prepare(`
                INSERT INTO daily_claims
                (
                    user_id
                )

                VALUES (?)
            `).run(
                req.session.userId
            );


            // ========================================
            // SEND NOTIFICATION
            // ========================================

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
// CLAIM CP GOAL
// ==================================================

app.post(
    "/claim-goal",
    (req, res) => {

        // Check login
        if (!req.session.userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Please log in first."

            });

        }


        const { goal } = req.body;


        // CP Goal rewards
        const rewards = {

            share: 50000,

            buycode: 50000

        };


        // Check valid goal
        if (
            !Object.prototype.hasOwnProperty.call(
                rewards,
                goal
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid goal."

            });

        }


        const reward =
            rewards[goal];


        try {


            // ==========================================
            // CHECK SHARE COMPLETION
            // ==========================================

            if (goal === "share") {

                const shareCompleted =
                    db.prepare(`
                        SELECT id
                        FROM share_completions
                        WHERE user_id = ?
                        LIMIT 1
                    `).get(
                        req.session.userId
                    );


                if (!shareCompleted) {

                    return res.json({

                        success: false,

                        message:
                            "Please share the website before claiming this reward."

                    });

                }

            }


            // ==========================================
            // CHECK BUY CODE PURCHASE
            // ==========================================

            if (goal === "buycode") {

                const purchasedCode =
                    db.prepare(`
                        SELECT id
                        FROM cp_codes
                        WHERE user_id = ?
                        LIMIT 1
                    `).get(
                        req.session.userId
                    );


                if (!purchasedCode) {

                    return res.json({

                        success: false,

                        message:
                            "Please buy CP code before claiming this reward."

                    });

                }

            }


            // ========================================
            // CHECK WHETHER THIS GOAL
            // WAS ALREADY CLAIMED
            // ========================================

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


            // ========================================
            // CHECK USER
            // ========================================

            const user =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE id = ?
                `).get(
                    req.session.userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            // ========================================
            // ADD REWARD TO BALANCE
            // ========================================

            db.prepare(`
                UPDATE users

                SET balance =
                    balance + ?

                WHERE id = ?
            `).run(

                reward,

                req.session.userId

            );


            // ========================================
            // RECORD GOAL CLAIM
            // ========================================

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


            // ========================================
            // SUCCESS MESSAGE
            // ========================================

            res.json({

                success: true,

                message:
                    goal === "share"
                        ? "Share goal claimed: NGN50,000"
                        : "Buy Code goal claimed: NGN50,000"

            });

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

                claimed: claimed

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
// COMPLETE CP SHARE
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

            /*
                Check whether the user has
                already completed the Share
                action.
            */

            const existing =
                db.prepare(`
                    SELECT id
                    FROM share_completions
                    WHERE user_id = ?
                    LIMIT 1
                `).get(
                    req.session.userId
                );


            if (existing) {

                return res.json({

                    success: true,

                    message:
                        "Share completed."

                });

            }


            /*
                Record that the browser's
                share operation completed.

                The reward is NOT added here.
            */

            db.prepare(`
                INSERT INTO share_completions
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
                    "Share completed. You can now claim your reward."

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
// ERROR HANDLER
// ==================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );


        if (
            error instanceof multer.MulterError
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

app.listen(
    3000,

    () => {

        console.log(
            "CryptPay is running at:"
        );

        console.log(
            "http://localhost:3000"
        );

    }
);
