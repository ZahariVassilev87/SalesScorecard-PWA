/**
 * Send backup notification email
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendBackupNotification(success, details = {}) {
  // Email configuration
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  const fromEmail = process.env.SMTP_FROM || 'Sales Scorecard <noreply@instorm.bg>';
  const notificationEmail = process.env.BACKUP_NOTIFICATION_EMAIL || 'zahari.vasilev@instorm.bg';

  // Check if email is configured
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.log('⚠️  Email not configured - skipping notification');
    console.log('   Set SMTP_USER, SMTP_PASS, and SMTP_HOST in .env');
    return;
  }

  try {
    const transporter = nodemailer.createTransport(emailConfig);

    const subject = success
      ? `✅ Database Backup Successful - ${new Date().toLocaleDateString('bg-BG')}`
      : `❌ Database Backup Failed - ${new Date().toLocaleDateString('bg-BG')}`;

    const html = `
      <h2>${subject}</h2>
      <p><strong>Time:</strong> ${new Date().toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}</p>
      ${success ? `
        <p><strong>Status:</strong> ✅ Backup completed successfully</p>
        ${details.backupPath ? `<p><strong>Backup Name:</strong> <code>${details.backupPath}</code></p>` : ''}
        ${details.backupFullPath ? `
          <p><strong>📁 Backup Location:</strong></p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all;">
            <a href="file://${details.backupFullPath}" style="color: #0066cc; text-decoration: none;">${details.backupFullPath}</a>
          </p>
          <p style="font-size: 12px; color: #666;">Копирайте пътя по-горе и го отворете във файловия мениджър или използвайте командата:</p>
          <p style="background-color: #f0f0f0; padding: 8px; border-radius: 3px; font-family: monospace; font-size: 12px;">
            cd ${details.backupFullPath}
          </p>
        ` : details.backupDir ? `
          <p><strong>📁 Backup Directory:</strong></p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all;">
            <a href="file://${details.backupDir}" style="color: #0066cc; text-decoration: none;">${details.backupDir}</a>
          </p>
        ` : ''}
        ${details.backupSize ? `<p><strong>Backup Size:</strong> ${details.backupSize}</p>` : ''}
        ${details.totalRows ? `<p><strong>Total Rows Backed Up:</strong> ${details.totalRows}</p>` : ''}
        ${details.tables ? `
          <p><strong>Tables Backed Up:</strong></p>
          <ul>
            ${Object.entries(details.tables).map(([table, count]) => `<li>${table}: ${count} rows</li>`).join('')}
          </ul>
        ` : ''}
      ` : `
        <p><strong>Status:</strong> ❌ Backup failed</p>
        ${details.error ? `<p><strong>Error:</strong> ${details.error}</p>` : ''}
      `}
      <p><strong>System:</strong> Sales Scorecard Production</p>
      <p><strong>Environment:</strong> Production Database</p>
      ${success ? `
        <hr>
        <p><small>This is an automated backup notification. Backup files are stored locally on the server.</small></p>
      ` : ''}
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: notificationEmail,
      subject,
      html,
    });

    console.log(`✅ Notification email sent to ${notificationEmail}`);
  } catch (error) {
    console.error('❌ Failed to send notification email:', error.message);
  }
}

// If called directly from command line
if (require.main === module) {
  const success = process.argv[2] === 'success';
  const details = process.argv[3] ? JSON.parse(process.argv[3]) : {};

  sendBackupNotification(success, details)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { sendBackupNotification };

