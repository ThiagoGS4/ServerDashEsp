import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs/promises';
import { unlink } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { type } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  await main();
})();


var leituraG = 1;

async function main() {
  const dadosEsp = path.join(__dirname, "dadosEsp"); //nome da pasta onde os dados ficam armazenados
  try {
    await fs.access(dadosEsp);
    leituraG = await lerUltimaLeitura();
  } catch {
    console.log("Pasta de dados não encontrada. Começando do zero.");
  }  
}

let dataHora = new Date();

//const PORT = process.env.port || process.env.PORT || 8080;
const apiRoot = "/api";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({ origin: ['https://salmon-water-07138e20f.azurestaticapps.net', 'https://salmon-water-07138e20f.6.azurestaticapps.net'] }));
app.options('*', cors());

const dados = {
        "1": {
            "leitura": leituraG,
            "velocidade": 0,
            "temperatura": 0,
            "humidade":0,
            "pressao":0,
            "altitude":0,
            "direcao":"Sudoeste"
        }
}

//configura as rotas
const router = express.Router();

router.get("/verDados/:leitura", (req, res) => {
  const id = parseInt(req.params.leitura);
  const leituraEncontrada = dados[id];

  if (!leituraEncontrada) {
      return res.status(404).json({ error: "ID de leitura inexistente!" });
  }

  return res.json(leituraEncontrada);
});


router.post("/enviarDados", async (req, res) => {
  const body = req.body;
  //validar valores do esp32
  if (body.velocidade === undefined || body.temperatura === undefined ||
      body.humidade === undefined || body.pressao === undefined ||
      body.altitude === undefined || body.direcao === undefined) {
    return res.status(400).json({ error: "algum sensor não está respondendo..." });
}

  //avaliar tipos
  if(body.velocidade && typeof(body.velocidade) !== 'number'|| body.temperatura && typeof(body.temperatura) !== 'number' || body.humidade && typeof(body.humidade) !== 'number' || body.pressao && typeof(body.pressao) !== 'number' || body.altitude && typeof(body.altitude) !== 'number'){
    body.velocidade = parseFloat(body.velocidade);
    body.temperatura = parseFloat(body.temperatura);
    body.humidade = parseFloat(body.humidade);
    body.pressao = parseFloat(body.pressao);
    body.altitude = parseFloat(body.altitude);

    if(isNaN(body.velocidade) || isNaN(body.temperatura) || isNaN(body.humidade) || isNaN(body.pressao) || isNaN(body.altitude)){
      return res
          .status(400)
          .json({ error: "algum dado não está como numérico..." });
    }
  }

  const novoId = leituraG;

  const armDados = {
    leitura: novoId,
    velocidade: body.velocidade,
    temperatura: body.temperatura,
    humidade: body.humidade,
    pressao: body.pressao,
    altitude: body.altitude,
    direcao: body.direcao,
    data: dataHora
  };

  await escreverDados("dadosEsp", leituraG, armDados); // Passando os parâmetros certos
  await escreverUltimaLeitura(); // Salva o último ID usado

  dados[novoId] = armDados;
  leituraG++;
  
    return res
        .status(201)
        .json(armDados);
});

const DATA_FOLDER = path.join(__dirname, "dadosEsp");

app.get("/api/dados", async (req, res) => {
  try {
    const files = await fs.readdir(DATA_FOLDER); // Lista arquivos
    const jsonFiles = files.filter(file => file.endsWith(".json")); // Filtra os JSONs

    const dados34 = await Promise.all(
      jsonFiles.map(async file => {
        const content = await fs.readFile(path.join(DATA_FOLDER, file), "utf-8");
        return JSON.parse(content);
      })
    );

    res.json(dados34); // Retorna os dados corretamente
  } catch (err) {
    console.error("Erro ao ler diretório:", err);
    res.status(500).json({ error: "Erro ao ler diretório" });
  }
});




//registra todas as rotas
app.use(apiRoot, router);

app.get('/', (req, res) => {
  res.send('Backend funcionando!');
});

/* app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
}); */

app.listen(8080, "0.0.0.0", () => {
  console.log("Servidor rodando na porta 8080...");
});


app.get('/api/mensagem', (req, res) => {
    res.json({ mensagem: 'Olá do backend! 🚀' }); //deixando aqui só para garantir que o back comunica com o front
  });

async function lerDados(dir) {
  let arquivos = [];

  const itens = await fs.readdir(dir, {withFileTypes: true});

  for (const item of itens) {
    if (item.isDirectory()){
      arquivos = arquivos.concat(
        await lerDados(dir, item.name)
      );
    }
    else{
      if(path.extname(item.name) === ".json"){
        arquivos.push(path.join(dir, item.name));
      }
    }
  }
  return arquivos;
}

async function escreverDados(dir, leituraID, dadosLeitura) {
  try {
    await fs.mkdir(dir, { recursive: true });

    const caminhoReg = path.join(dir, `leitura${leituraID}.json`);
    await fs.writeFile(caminhoReg, JSON.stringify(dadosLeitura, null, 2));

    console.log(`Dados de leitura ${leituraID} salvos.`);
  } catch (err) {
    console.error("Erro ao salvar dados da leitura:", err);
  }
}


async function escreverUltimaLeitura(){
  const ultima = path.join(__dirname, "ultimaLeitura");
  try{
    await fs.mkdir(ultima, { recursive: true })
  }
  catch{
    console.log("pasta 'ultimaLeitura' já foi criada.");
  }
  const caminhoLeitura = path.join(ultima, `ultimoID.json`);
  await fs.writeFile(caminhoLeitura, JSON.stringify(leituraG, null, 2));
  console.log(`Último ID (${leituraG}) salvo.`);
}

async function lerUltimaLeitura() {
  try {
    const caminhoLeitura = path.join(__dirname, "ultimaLeitura/ultimoID.json");
    const data = await fs.readFile(caminhoLeitura, "utf-8");
    const ultimoID = JSON.parse(data);
    return ultimoID + 1;
  } catch (err) {
    console.log("Nenhum ID salvo. Iniciando em 1.");
    return 1;
  }
}
