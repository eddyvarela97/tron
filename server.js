const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('.'));

// Ensure data directories exist
const DATA_DIR = path.join(__dirname, 'data');
const GAMES_DIR = path.join(DATA_DIR, 'games');
const MODEL_DIR = path.join(DATA_DIR, 'model');

async function ensureDirectories() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(GAMES_DIR, { recursive: true });
        await fs.mkdir(MODEL_DIR, { recursive: true });

        // Initialize model file if it doesn't exist
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        try {
            await fs.access(modelPath);
        } catch {
            // Create initial model structure
            const initialModel = {
                weights: null,
                config: {
                    inputSize: 20,
                    hiddenLayers: [64, 32],
                    outputSize: 4,
                    learningRate: 0.001
                },
                stats: {
                    gamesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    avgSurvivalTime: 0
                },
                version: 1
            };
            await fs.writeFile(modelPath, JSON.stringify(initialModel, null, 2));
        }
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// API Routes

// Get the current model
app.get('/api/model', async (req, res) => {
    try {
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        const data = await fs.readFile(modelPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading model:', error);
        res.status(500).json({ error: 'Failed to load model' });
    }
});

// Update the model
app.post('/api/model', async (req, res) => {
    try {
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        const currentModel = JSON.parse(await fs.readFile(modelPath, 'utf8'));

        // Merge updates with current model
        const updatedModel = {
            ...currentModel,
            ...req.body,
            version: currentModel.version + 1,
            lastUpdated: new Date().toISOString()
        };

        await fs.writeFile(modelPath, JSON.stringify(updatedModel, null, 2));
        res.json({ success: true, version: updatedModel.version });
    } catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ error: 'Failed to update model' });
    }
});

// Save a game recording
app.post('/api/games', async (req, res) => {
    try {
        const gameData = req.body;
        const timestamp = Date.now();
        const gameId = `game_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        const filename = `${gameId}.json`;
        const filepath = path.join(GAMES_DIR, filename);

        // Add metadata
        gameData.id = gameId;
        gameData.timestamp = timestamp;
        gameData.date = new Date().toISOString();

        await fs.writeFile(filepath, JSON.stringify(gameData, null, 2));

        // Update model stats
        const modelPath = path.join(MODEL_DIR, 'ares_model.json');
        const model = JSON.parse(await fs.readFile(modelPath, 'utf8'));

        model.stats.gamesPlayed++;
        if (gameData.winner === 'ares') {
            model.stats.wins++;
        } else if (gameData.winner === 'player') {
            model.stats.losses++;
        }

        // Update average survival time
        const survivalTime = gameData.aresData?.survivalTime || 0;
        model.stats.avgSurvivalTime =
            (model.stats.avgSurvivalTime * (model.stats.gamesPlayed - 1) + survivalTime)
            / model.stats.gamesPlayed;

        await fs.writeFile(modelPath, JSON.stringify(model, null, 2));

        res.json({
            success: true,
            gameId: gameId,
            stats: model.stats
        });
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({ error: 'Failed to save game' });
    }
});

// Get recent games for training
app.get('/api/games/recent/:count', async (req, res) => {
    try {
        const count = parseInt(req.params.count) || 10;
        const files = await fs.readdir(GAMES_DIR);

        // Sort by timestamp (newest first)
        const gameFiles = files
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a))
            .slice(0, count);

        const games = [];
        for (const file of gameFiles) {
            const data = await fs.readFile(path.join(GAMES_DIR, file), 'utf8');
            games.push(JSON.parse(data));
        }

        res.json(games);
    } catch (error) {
        console.error('Error reading games:', error);
        res.status(500).json({ error: 'Failed to load games' });
    }
});

// Get training data from all games
app.get('/api/training-data', async (req, res) => {
    try {
        const files = await fs.readdir(GAMES_DIR);
        const trainingData = [];

        for (const file of files.filter(f => f.endsWith('.json'))) {
            const data = JSON.parse(await fs.readFile(path.join(GAMES_DIR, file), 'utf8'));

            // Extract training samples from game frames
            if (data.frames && data.frames.length > 0) {
                data.frames.forEach(frame => {
                    if (frame.aresDecision && frame.gameState) {
                        trainingData.push({
                            input: frame.gameState.features,
                            output: frame.aresDecision.action,
                            reward: frame.aresDecision.reward || 0
                        });
                    }
                });
            }
        }

        res.json(trainingData);
    } catch (error) {
        console.error('Error getting training data:', error);
        res.status(500).json({ error: 'Failed to get training data' });
    }
});

// Export games data as CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const files = await fs.readdir(GAMES_DIR);
        const games = [];

        // Load all games
        for (const file of files.filter(f => f.endsWith('.json'))) {
            const data = JSON.parse(await fs.readFile(path.join(GAMES_DIR, file), 'utf8'));
            games.push(data);
        }

        // Sort by timestamp
        games.sort((a, b) => a.timestamp - b.timestamp);

        // Create CSV content
        const csvHeader = [
            'Game_Number',
            'Game_ID',
            'Date',
            'Mode',
            'Winner',
            'Duration_ms',
            'Duration_seconds',
            'Death_Cause',
            'Ares_Decisions_Count',
            'Ares_Survival_Time_ms',
            'Ares_Survival_Time_seconds',
            'Frames_Count',
            'Avg_Decision_Time_ms',
            'Player_Won',
            'Ares_Won'
        ].join(',');

        const csvRows = games.map((game, index) => {
            const durationSeconds = Math.round(game.duration / 1000 * 100) / 100;
            const aresSurvivalSeconds = game.aresData?.survivalTime ?
                Math.round(game.aresData.survivalTime / 1000 * 100) / 100 : 0;
            const decisionsCount = game.aresData?.decisions?.length || 0;
            const avgDecisionTime = game.frames?.length > 0 ?
                Math.round(game.duration / game.frames.length * 100) / 100 : 0;

            return [
                index + 1,
                game.id || `game_${index}`,
                game.date || new Date(game.timestamp).toISOString(),
                game.mode || 'unknown',
                game.winner || 'unknown',
                game.duration || 0,
                durationSeconds,
                game.deathCause || 'unknown',
                decisionsCount,
                game.aresData?.survivalTime || 0,
                aresSurvivalSeconds,
                game.frames?.length || 0,
                avgDecisionTime,
                game.winner === 'player' ? 1 : 0,
                game.winner === 'ares' ? 1 : 0
            ].join(',');
        });

        const csvContent = [csvHeader, ...csvRows].join('\n');

        // Set CSV headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="ares_ai_games.csv"');
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
});

// Start server
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Tron Ares server running on http://localhost:${PORT}`);
        console.log(`Open http://localhost:${PORT}/index.html to play`);
    });
});