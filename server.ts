import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("nutriq.db");

// Inicializa o banco de dados
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    weight REAL DEFAULT 80,
    age INTEGER,
    gender TEXT,
    height REAL,
    activity_level TEXT,
    goal TEXT,
    plan TEXT DEFAULT 'FREE_TRIAL',
    trial_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    food_name TEXT,
    calories REAL,
    protein REAL,
    carbs REAL,
    fats REAL,
    portion_size TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    text TEXT,
    type TEXT DEFAULT 'text',
    sender TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS educational_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    category TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed educational content if empty
const contentCount = db.prepare("SELECT COUNT(*) as count FROM educational_content").get() as { count: number };
if (contentCount.count === 0) {
  const seed = [
    { title: "O que é Déficit Calórico?", content: "Déficit calórico é o estado em que você queima mais calorias do que consome. É a base fundamental para o emagrecimento saudável.", category: "Básico" },
    { title: "Metabolismo Basal", content: "Sua Taxa Metabólica Basal (TMB) é a quantidade de energia que seu corpo gasta para manter as funções vitais em repouso.", category: "Fisiologia" },
    { title: "Proteínas e Saciedade", content: "Consumir proteínas adequadas ajuda a manter a massa muscular e aumenta a sensação de saciedade durante o dia.", category: "Nutrição" }
  ];
  const insert = db.prepare("INSERT INTO educational_content (title, content, category) VALUES (?, ?, ?)");
  seed.forEach(item => insert.run(item.title, item.content, item.category));
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API: Buscar ou criar perfil de usuário
  app.get("/api/user/:id", (req, res) => {
    const { id } = req.params;
    let user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    
    if (!user) {
      db.prepare("INSERT INTO users (id) VALUES (?)").run(id);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    }
    res.json(user);
  });

  // API: Atualizar perfil do usuário
  app.post("/api/user/:id/profile", (req, res) => {
    const { id } = req.params;
    const { weight, age, gender, height, activity_level, goal, plan } = req.body;
    
    const fields = [];
    const values = [];
    
    if (weight !== undefined) { fields.push("weight = ?"); values.push(weight); }
    if (age !== undefined) { fields.push("age = ?"); values.push(age); }
    if (gender !== undefined) { fields.push("gender = ?"); values.push(gender); }
    if (height !== undefined) { fields.push("height = ?"); values.push(height); }
    if (activity_level !== undefined) { fields.push("activity_level = ?"); values.push(activity_level); }
    if (goal !== undefined) { fields.push("goal = ?"); values.push(goal); }
    if (plan !== undefined) { fields.push("plan = ?"); values.push(plan); }
    if (req.body.avatar !== undefined) { fields.push("avatar = ?"); values.push(req.body.avatar); }
    
    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
    res.json({ success: true });
  });

  // API: Buscar mensagens do chat
  app.get("/api/messages/:user_id", (req, res) => {
    const { user_id } = req.params;
    const messages = db.prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC").all(user_id);
    res.json(messages);
  });

  // API: Enviar mensagem
  app.post("/api/messages", (req, res) => {
    const { user_id, text, type, sender } = req.body;
    db.prepare("INSERT INTO messages (user_id, text, type, sender) VALUES (?, ?, ?, ?)")
      .run(user_id, text, type || 'text', sender || 'user');
    res.json({ success: true });
  });

  // API: Buscar conteúdo educacional
  app.get("/api/content", (req, res) => {
    const content = db.prepare("SELECT * FROM educational_content ORDER BY created_at DESC").all();
    res.json(content);
  });

  // API: Buscar histórico de scans
  app.get("/api/scans/:user_id", (req, res) => {
    const { user_id } = req.params;
    const scans = db.prepare("SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(user_id);
    res.json(scans);
  });

  // API: Salvar histórico de scan
  app.post("/api/scan", (req, res) => {
    const { user_id, food_name, calories, protein, carbs, fats, portion_size } = req.body;
    db.prepare("INSERT INTO scans (user_id, food_name, calories, protein, carbs, fats, portion_size) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(user_id, food_name, calories, protein, carbs, fats, portion_size);
    res.json({ success: true });
  });

  // Vite middleware para desenvolvimento
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NutriQ Server running on http://localhost:${PORT}`);
  });
}

startServer();
