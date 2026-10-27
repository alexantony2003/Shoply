const nodemailer = require("nodemailer");

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const shopName = "Shoply";

if (!emailUser || !emailPass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be configured in .env");
}

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: emailUser,
        pass: emailPass
    },
    tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== "true"
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

const sendOTP = async (email, otp) => {
    const safeOtp = String(otp).replace(/[^0-9]/g, "");

    await transporter.sendMail({
        from: `"${shopName}" <${emailUser}>`,
        replyTo: emailUser,
        to: email,
        subject: `${shopName} verification code`,
        text: [
            `Your ${shopName} verification code is ${safeOtp}.`,
            "",
            "This code expires in 5 minutes.",
            "If you did not create a Shoply account, you can ignore this email."
        ].join("\n"),
        html: `
            <!doctype html>
            <html lang="en">
            <body style="margin:0;background:#f4f6f8;color:#20252b;font-family:Arial,Helvetica,sans-serif;">
                <div style="padding:36px 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
                        <tr>
                            <td style="padding:28px 32px 18px;text-align:center;">
                                <div style="color:#2563eb;font-size:24px;font-weight:700;">${shopName}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 32px 32px;">
                                <h1 style="margin:10px 0 12px;font-size:24px;line-height:1.3;text-align:center;color:#20252b;">Verify your email</h1>
                                <p style="margin:0 0 24px;text-align:center;color:#667085;font-size:16px;line-height:1.5;">Use the verification code below to finish creating your Shoply account.</p>
                                <div style="margin:0 auto 24px;padding:18px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;">${safeOtp}</div>
                                <p style="margin:0;text-align:center;color:#667085;font-size:14px;line-height:1.5;">This code expires in 5 minutes.</p>
                                <p style="margin:20px 0 0;text-align:center;color:#98a2b3;font-size:13px;line-height:1.5;">If you did not create a Shoply account, you can safely ignore this email.</p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin:18px auto 0;max-width:560px;text-align:center;color:#98a2b3;font-size:12px;">This is an automated message from Shoply. Please do not reply.</p>
                </div>
            </body>
            </html>
        `
    });
};

sendOTP.sendPasswordResetOTP = async (email, otp) => {
    const safeOtp = String(otp).replace(/[^0-9]/g, "");
    await transporter.sendMail({
        from: `"${shopName}" <${emailUser}>`,
        replyTo: emailUser,
        to: email,
        subject: `${shopName} password reset code`,
        text: `Your ${shopName} password reset code is ${safeOtp}. It expires in 5 minutes. If you did not request a password reset, ignore this email.`,
        html: `<p>Your Shoply password reset code is <strong>${safeOtp}</strong>.</p><p>It expires in 5 minutes. If you did not request this reset, ignore this email.</p>`
    });
};

module.exports = sendOTP;