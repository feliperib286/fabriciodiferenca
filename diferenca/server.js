const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use("/output", express.static("output"));

const upload = multer({ dest: "uploads/" });

app.post("/comparar", upload.fields([{ name: "imagem1" }, { name: "imagem2" }]), (req, res) => {
  const img1Path = req.files.imagem1[0].path;
  const img2Path = req.files.imagem2[0].path;

  const ext1 = path.extname(req.files.imagem1[0].originalname).toLowerCase();
  const ext2 = path.extname(req.files.imagem2[0].originalname).toLowerCase();

  if (ext1 !== ".png" || ext2 !== ".png") {
    return res.send("<h2>Erro: As imagens devem estar no formato PNG.</h2><a href='/'>Voltar</a>");
  }

  const img1 = fs.createReadStream(img1Path).pipe(new PNG()).on("parsed", doneReading);
  const img2 = fs.createReadStream(img2Path).pipe(new PNG()).on("parsed", doneReading);

  let filesRead = 0;

  function doneReading() {
    if (++filesRead < 2) return;

    if (img1.width !== img2.width || img1.height !== img2.height) {
      fs.unlinkSync(img1Path);
      fs.unlinkSync(img2Path);
      return res.send("<h2>Erro: As imagens devem ter o mesmo tamanho.</h2><a href='/'>Voltar</a>");
    }

    const { width, height } = img1;
    const threshold = 50;
    let coords = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;

        const r1 = img1.data[idx];
        const g1 = img1.data[idx + 1];
        const b1 = img1.data[idx + 2];

        const r2 = img2.data[idx];
        const g2 = img2.data[idx + 1];
        const b2 = img2.data[idx + 2];

        const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

        if (diff > threshold) {
          img1.data[idx] = 255;
          img1.data[idx + 1] = 0;
          img1.data[idx + 2] = 0;
          img1.data[idx + 3] = 200;
          coords.push({ x, y });
        }
      }
    }

    img1.pack().pipe(fs.createWriteStream("output/diferenca.png")).on("finish", () => {
      fs.unlinkSync(img1Path);
      fs.unlinkSync(img2Path);

      const html = `
        <h1>Diferença destacada na imagem original</h1>
        <img src="/output/diferenca.png?${Date.now()}" width="500" />
        <p>Total de pontos com diferença: ${coords.length}</p>
        <p>Exemplo de coordenada com diferença: ${
          coords.length > 0 ? JSON.stringify(coords[0]) : "Nenhuma diferença significativa"
        }</p>
        <a href="/">Voltar</a>
      `;
      res.send(html);
    });
  }
});

app.listen(PORT, () => {
  console.log("Servidor rodando em http://localhost:" + PORT);
});
