# Tron Game with Ares AI

A classic Tron light cycle game featuring an AI opponent powered by machine learning that learns from gameplay.

## Features

### 🎮 Game Modes
- **2 Player**: Traditional human vs human gameplay
- **VS Ares**: Human vs AI with machine learning opponent

### 🤖 Ares AI Capabilities
- **Real-time Decision Making**: Neural network processes game state and makes decisions in real-time
- **Dynamic Learning**: Records gameplay data and updates model after each game
- **Non-deterministic**: Responds to stimuli like approaching walls or enemy players
- **Collision Avoidance**: Trained to avoid walls, own trail, and enemy trails
- **Adaptive Behavior**: Uses exploration to discover new strategies

### 📊 Learning System
- **Game Recording**: Captures player decisions, game state, and outcomes
- **Death Cause Tracking**: Records whether death was due to wall, own trail, or enemy trail
- **Continuous Learning**: Model weights update based on gameplay performance
- **Training Data Storage**: Games saved as JSON files for persistent learning

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Play the Game**
   - Open http://localhost:3000/index.html
   - Select game mode (2 Player or VS Ares)
   - Use controls to play

## Controls

### Human Player (Cyan)
- **W** - Move Up
- **A** - Move Left
- **S** - Move Down
- **D** - Move Right

### Player 2 (2-Player Mode)
- **↑** - Move Up
- **←** - Move Left
- **↓** - Move Down
- **→** - Move Right

## How Ares AI Works

### Neural Network Architecture
- **Input Layer**: 20 features including position, direction, distances to walls, opponent data
- **Hidden Layers**: 64 → 32 neurons with ReLU activation
- **Output Layer**: 4 neurons for movement directions (up, down, left, right)

### Feature Extraction
Ares analyzes:
- Current position and direction
- Distance to walls in all directions
- Opponent position and movement
- Available space estimation
- Danger level assessment
- Trail density analysis

### Learning Process
1. **Game Recording**: Every decision and game state recorded
2. **Outcome Analysis**: Win/loss affects decision rewards
3. **Model Updates**: Neural network weights updated after each game
4. **Exploration**: 10% random actions to discover new strategies

### Data Storage
- **Game Files**: `data/games/` - Individual game recordings
- **Model Data**: `data/model/ares_model.json` - Neural network weights and stats
- **Training Pipeline**: Automatic model updates after games

## File Structure

```
tron/
├── index.html          # Game UI and styling
├── tron.js             # Core game logic
├── ares.js             # Ares AI implementation
├── server.js           # Node.js backend server
├── package.json        # Dependencies
├── data/
│   ├── games/          # Recorded gameplay data
│   └── model/          # AI model weights and config
└── README.md           # This file
```

## API Endpoints

- **GET /api/model** - Get current AI model
- **POST /api/model** - Update AI model
- **POST /api/games** - Save game recording
- **GET /api/games/recent/:count** - Get recent games
- **GET /api/training-data** - Get training dataset

## Development

### Running in Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Adding Features
The modular design allows easy extension:
- Modify `ares.js` for AI improvements
- Update `tron.js` for game mechanics
- Extend `server.js` for new API endpoints

### Training Data Format
```json
{
  "id": "game_123456789",
  "mode": "ares",
  "winner": "player|ares",
  "duration": 15000,
  "deathCause": "wall|own_trail|enemy_trail",
  "frames": [
    {
      "timestamp": 1000,
      "aresDecision": {
        "action": 0,
        "position": {"x": 50, "y": 60}
      },
      "gameState": {
        "features": [0.4, 0.5, 1, 0, 0, 0, ...]
      }
    }
  ]
}
```

## Technical Details

### Real-time AI Processing
- Decision making happens every game frame (~20 FPS)
- Neural network forward pass completes in <5ms
- Exploration ensures non-deterministic behavior

### Learning Improvements
The AI improves through:
- **Temporal Credit Assignment**: Recent decisions weighted more heavily
- **Reward Shaping**: Survival time and space control rewarded
- **Experience Replay**: Learning from past successful games

### Performance Optimization
- Efficient feature extraction algorithms
- Minimal memory footprint for neural network
- Asynchronous model updates don't block gameplay

## Future Enhancements

- Multiple AI difficulty levels
- Tournament mode with AI vs AI
- Visual decision explanation
- Custom training scenarios
- Online learning during gameplay
- Model versioning and rollback

---

Built with vanilla JavaScript, Node.js, and custom neural network implementation.