const nodemailer = require("nodemailer");
const randomstring = require("randomstring");
const winston = require("winston");
const fs = require("fs-extra");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message }) => {
      return `${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

const smtpCheckedFilePath = "smtp_checked.txt";
const testEmail = "lapeste2023@outlook.com";
const concurrentLimit = 20;
const batchSize = 5;

const generateRandomEmail = () => {
  const subjects = [
    "¿Podemos agendar una reunión rápida?",
    "Una idea que podría interesarte",
    "¡Gran noticia para ti!",
    "Confirmación de tu última compra",
    "Tu cuenta está a punto de vencer",
    "Recordatorio: Actualiza tu información",
    "Re: Sobre nuestro último encuentro",
    "¡Tienes un nuevo mensaje!",
    "Notificación importante sobre tu cuenta",
    "Un saludo especial para ti",
  ];

  const greetings = [
    "Hola,",
    "Estimado/a,",
    "¡Hola! Espero que estés bien.",
    "¡Buen día!",
    "Querido/a [Nombre],",
  ];

  const intros = [
    "Quería ponerme en contacto contigo para discutir un tema que creo que te interesará.",
    "Espero que estés teniendo una semana productiva. Quería informarte sobre una oportunidad interesante.",
    "Me alegra mucho poder compartir esta noticia contigo.",
    "He estado pensando en nuestra última conversación, y quería ofrecerte algunas ideas.",
    "Quería recordarte que tu cuenta está a punto de vencer. Por favor, actualiza tu información para evitar interrupciones.",
    "Te envío este correo para confirmar los detalles de tu última compra. Si tienes alguna duda, no dudes en contactarnos.",
  ];

  const bodies = [
    "He pensado en algunas formas en las que podríamos mejorar nuestro proyecto conjunto. ¿Podríamos agendar una reunión para discutirlo?",
    "Tengo una propuesta que podría beneficiarte en gran medida. Si estás disponible, me encantaría explicarte más.",
    "Tu cuenta está a punto de vencer, y queremos asegurarnos de que no pierdas acceso a tus beneficios. Te agradeceríamos que actualices tu información lo antes posible.",
    "Si necesitas ayuda con cualquier cosa, no dudes en responder a este correo. Estoy aquí para ayudarte.",
    "Recuerda que estamos siempre a tu disposición para cualquier consulta o inquietud que puedas tener.",
    "Estoy seguro/a de que esta información será de gran valor para ti. Por favor, hazme saber si tienes alguna pregunta o si deseas profundizar más en el tema.",
  ];

  const signOffs = [
    "Saludos cordiales,",
    "Atentamente,",
    "Un abrazo,",
    "Con todo mi respeto,",
    "Quedo a tu disposición,",
    "Gracias por tu atención,",
  ];

  const signatures = [
    "Andrés Salvatierra",
    "El equipo de Soporte",
    "María González",
    "Juan Pérez",
    "Carla Fernández",
    "Luis Rojas",
  ];

  // Seleccionar elementos aleatorios para crear un correo único y humanizado
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  const intro = intros[Math.floor(Math.random() * intros.length)];
  const body = bodies[Math.floor(Math.random() * bodies.length)];
  const signOff = signOffs[Math.floor(Math.random() * signOffs.length)];
  const signature = signatures[Math.floor(Math.random() * signatures.length)];

  const text = `${greeting}\n\n${intro}\n\n${body}\n\n${signOff}\n${signature}`;

  return { subject, text };
};

const saveSmtpUrl = async (smtpUrl) => {
  try {
    const fileContent = await fs.readFile(smtpCheckedFilePath, "utf8");
    const smtpUrls = fileContent.split("\n");

    if (!smtpUrls.includes(smtpUrl.trim())) {
      await fs.appendFile(smtpCheckedFilePath, `${smtpUrl.trim()}\n`);
      logger.info(`💾 SMTP URL guardada`);
    } else {
      logger.info(`🙅‍♂️ SMTP URL ya existe`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(smtpCheckedFilePath, `${smtpUrl.trim()}\n`);
      logger.info(`💾 Archivo creado y SMTP URL guardada`);
    } else {
      logger.error(
        `Error al escribir en el archivo ${smtpCheckedFilePath}: ${error.message}`
      );
    }
  }
};

const trySmtpConnection = async (smtpUrl) => {
  const url = new URL(smtpUrl);

  // Determinar si usar TLS basado en el puerto
  const isSecure = url.port == "465";
  const tlsOptions = {
    rejectUnauthorized: false,
  };

  const transporter = nodemailer.createTransport({
    host: url.hostname,
    port: url.port,
    secure: isSecure,
    auth: {
      user: decodeURIComponent(url.username),
      pass: decodeURIComponent(url.password),
    },
    timeout: 5000,
    tls: isSecure ? tlsOptions : url.port === "587" ? tlsOptions : false,
  });
  const { subject, text } = generateRandomEmail();
  const fromName = url.username.split("@")[0];
  const fromEmail = `${fromName}@${url.hostname}`;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: testEmail,
    subject,
    text,
    headers: {
      "X-Priority": "1 (Highest)",
      "X-MSMail-Priority": "High",
      Importance: "High",
      "Message-ID": `<${randomstring.generate(12)}>`,
    },
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info("🎉 Email sent successfully!");
    await saveSmtpUrl(smtpUrl);
    return true;
  } catch (error) {
    logger.error(`❌ Error al enviar el email: ${error.message}`);
    return false;
  }
};

const processBatch = async (batch) => {
  const promises = batch.map(async (smtpUrl) => {
    try {
      logger.info(`Trying SMTP: ${smtpUrl}...`);
      const isConnected = await trySmtpConnection(smtpUrl);
      if (isConnected) {
        logger.info("SMTP connection successful!");
      }
    } catch (error) {
      logger.error(
        `Error in SMTP processing: ${error.message} - URL: ${smtpUrl}`
      );
    }
  });

  for (let i = 0; i < promises.length; i += concurrentLimit) {
    await Promise.all(promises.slice(i, i + concurrentLimit));
  }
};

const readSmtpUrls = async () => {
  try {
    const data = await fs.readFile("smtp_extracted.txt", "utf-8");
    const urls = data.split("\n").filter((url) => url.trim().length > 0);
    return urls.map((url) => url.trim());
  } catch (error) {
    logger.error("Failed to read smtp_extracted.txt file.");
    throw error;
  }
};

const processSmtpUrls = async () => {
  const smtpUrls = await readSmtpUrls();
  logger.info(`🔎 Analyzing ${smtpUrls.length} SMTP URLs...`);

  for (let i = 0; i < smtpUrls.length; i += batchSize) {
    console.clear();
    const batch = smtpUrls.slice(i, i + batchSize);
    logger.info(`🚀 Processing batch ${i / batchSize + 1}...`);
    await processBatch(batch);
  }

  logger.info("🏁 SMTP checking process completed.");
};

async function smtp_checker() {
  await processSmtpUrls();
  process.exit(0);
}
module.exports = smtp_checker;
