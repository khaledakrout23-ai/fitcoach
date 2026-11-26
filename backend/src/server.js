require('dotenv').config();
const app = require('./app');
const { DataTypes } = require('sequelize');
const { sequelize, NutritionTarget, Meal, EmailCode } = require('./models');
const { hasMail } = require('./services/mailer');
const { hasAI } = require('./services/gemini');

const PORT = Number(process.env.PORT || 4000);

async function start() {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // crée les tables manquantes (sans effacer les données)
  } catch (err) {
    // ECONNREFUSED arrive avec un message vide : on affiche aussi le code
    const code = err.original?.code || err.parent?.code;
    console.error('Impossible de se connecter à MySQL :', err.message || code || err.name);
    if (code === 'ECONNREFUSED') {
      console.error(`MySQL ne répond pas sur ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}. Démarrez WAMP (icône verte) puis relancez.`);
    }
    console.error('Vérifiez le fichier .env puis lancez "npm run db:setup".');
    process.exit(1);
  }
  // tables de la section repas : créées si elles n'existent pas encore (sans toucher aux autres données)
  try {
    await NutritionTarget.sync();
    await Meal.sync();
  } catch (err) {
    console.error('Tables nutrition non créées :', err.message);
  }
  // vérification d'e-mail : colonne ajoutée aux comptes existants (considérés comme vérifiés) + table des codes
  try {
    const columns = await sequelize.getQueryInterface().describeTable('users');
    if (!columns.email_verified) {
      await sequelize.getQueryInterface().addColumn('users', 'email_verified', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
      console.log('Colonne users.email_verified ajoutée (comptes existants marqués comme vérifiés).');
    }
    await EmailCode.sync();
  } catch (err) {
    console.error('Vérification e-mail non initialisée :', err.message);
  }
  // 0.0.0.0 : accessible depuis le téléphone sur le même Wi-Fi (application mobile)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`API FitCoach AI : http://localhost:${PORT}/api`);
    console.log(hasAI() ? 'Coach IA : Gemini activé' : 'Coach IA : mode simple (ajoutez GEMINI_API_KEY dans .env pour activer Gemini)');
    console.log(hasMail() ? 'E-mails : SMTP activé' : 'E-mails : SMTP non configuré, les codes sont affichés dans cette console (ajoutez SMTP_* dans .env)');
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Le port ${PORT} est déjà utilisé : le serveur tourne probablement déjà dans un autre terminal.`);
      console.error(`Fermez l'autre terminal, ou libérez le port : npx kill-port ${PORT}`);
    } else {
      console.error('Erreur du serveur :', err.message);
    }
    process.exit(1);
  });
}

start();
