const functions = require("firebase-functions");
const cors = require("cors")({ origin: true }); // সব origin allow করা হয়েছে
const nodemailer = require("nodemailer");

exports.sendBuyerReport = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send({ message: "Method Not Allowed" });
        }

        try {
            const { to_email, subject, html } = req.body;

            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: {
                    user: "your.email@gmail.com",
                    pass: "your_app_password"
                }
            });

            await transporter.sendMail({
                from: '"Report Erp" <your.email@gmail.com>',
                to: to_email,
                subject: subject,
                html: html
            });

            res.status(200).send({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).send({ success: false, message: err.message });
        }
    });
});
