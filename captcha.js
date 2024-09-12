const fs = require("fs");
const fetch = require("node-fetch2");
const cloudinary = require("cloudinary").v2;
const { AssemblyAI } = require("assemblyai");
const dotenv = require("dotenv").config();

// Configura Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

async function managePayload(secondIframe, attempts = 0) {
  try {
    const payload = await getBypass();
    const res = await secondIframe.evaluate(async (payload) => {
      document.querySelector("#audio-response").value = payload;
      document.querySelector("#recaptcha-verify-button").click();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Agrega un tiempo de espera de 1 segundo
      const res = document.querySelector(".rc-audiochallenge-error-message");
      return res?.textContent || "";
    }, payload);

    if (
      res.match(
        /se requieren varias soluciones correctas|multiple correct solutions required|need more correct answers|additional correct solutions required|more correct answers needed/i
      )
    ) {
      console.log("Bypass failed");
      console.log("Retrying...");
      if (attempts < 3) {
        await managePayload(secondIframe, attempts + 1);
      } else {
        return false;
      }
    } else if (res === "" || !res) {
      console.log("=================\nCaptcha bypassed");
      return true;
    } else {
      console.log("Unknown error");
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function solveCaptcha(page, oneTime = false) {
  const iframeSelector = 'iframe[title="reCAPTCHA"]';

  try {
    async function getValidFrame(selector, oneTime) {
      let iframeElement;
      let iframe;
      let tries = 2;
      if (oneTime) {
        tries = 1;
      }

      for (let attempt = 0; attempt < tries; attempt++) {
        try {
          iframeElement = await page.waitForSelector(selector, {
            timeout: 5000,
          });
          iframe = await iframeElement.contentFrame();

          if (iframe) {
            return iframe;
          }
        } catch (err) {
          console.log("=================");
          console.warn(`Verifying reCaptcha...`);
        }
      }
      return 404;
    }

    const firstIframe = await getValidFrame(iframeSelector, oneTime);
    if (!firstIframe || firstIframe === 404) {
      return firstIframe;
    }

    const checkboxSelector = "div.rc-anchor-checkbox-holder";
    const checkboxElement = await firstIframe.waitForSelector(
      checkboxSelector,
      { visible: true }
    );

    if (checkboxElement) {
      await checkboxElement.click();
    } else {
      console.error("reCAPTCHA checkbox not found.");
    }

    const challengeIframeSelector =
      'iframe[title="el desafío de recaptcha caduca dentro de dos minutos"]';
    const secondIframe = await getValidFrame(challengeIframeSelector, oneTime);

    await secondIframe.waitForSelector("#recaptcha-audio-button");
    await secondIframe.evaluate(() => {
      document.querySelector("#recaptcha-audio-button").click();
    });

    await secondIframe.waitForSelector(".rc-audiochallenge-tdownload-link", {
      timeout: 10000,
    });
    const linkAudio = await secondIframe.evaluate(() => {
      let link = document.querySelector(".rc-audiochallenge-tdownload-link");
      return link.getAttribute("href");
    });

    await downloadAudio(linkAudio, "output.mp3");
    await uploadToCloudinary("output.mp3"); // Subir archivo a Cloudinary
    await managePayload(secondIframe, 0);
    return;
  } catch (err) {
    if (err.message.includes("rc-audiochallenge-tdownload-link")) {
      console.log(
        "Your IP has been banned. Please try again later or use proxy."
      );
      return null;
    }
    console.error("Error al resolver el CAPTCHA: " + err.message);
    return null;
  }
}

const downloadAudio = async (url, outputPath) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        "La descarga falló, código de estado: " + response.status
      );
    }
    const buffer = await response.buffer();
    fs.writeFileSync(outputPath, buffer);
  } catch (err) {
    console.error(
      "Error al descargar el audio en formato .mp3: " + err.message
    );
  }
};

const uploadToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "video", // Cloudinary maneja archivos de audio como video
      folder: "audios", // Carpeta en Cloudinary
    });

    console.log("Archivo subido a Cloudinary:", result.secure_url);
    return result.secure_url; // URL pública del archivo subido
  } catch (error) {
    console.error("Error al subir el archivo a Cloudinary: ", error);
    throw error;
  }
};

async function getBypass() {
  const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY,
  });

  const audioUrl = await uploadToCloudinary("output.mp3");

  const config = {
    audio_url: audioUrl,
  };

  const run = async () => {
    const transcript = await client.transcripts.transcribe(config);
    if (transcript.text) {
      return transcript.text;
    } else {
      return null;
    }
  };

  return await run();
}

module.exports = { solveCaptcha };
