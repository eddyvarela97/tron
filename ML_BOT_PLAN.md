# Tron ML Bot Implementation Plan

## Overview
Transform the existing two-player Tron game into a single-player game with a machine learning-powered bot opponent that learns from recorded gameplay data.

## Architecture

### 1. Game Recording System
**Purpose**: Capture gameplay data for training the ML model

#### Data Structure
```javascript
{
  gameId: string,
  timestamp: number,
  winner: 'player1' | 'player2' | 'draw',
  duration: number,
  frames: [
    {
      frameNumber: number,
      player1: { x, y, dx, dy, alive },
      player2: { x, y, dx, dy, alive },
      player1Trail: [{x, y}, ...],
      player2Trail: [{x, y}, ...],
      player1Decision: 'up' | 'down' | 'left' | 'right',
      player2Decision: 'up' | 'down' | 'left' | 'right'
    }
  ]
}
```

#### Recording Features
- Automatic recording of all games
- Export to JSON format
- Compression for large datasets
- Filtering for quality games (minimum duration, no early crashes)

### 2. Neural Network Architecture

#### Model Design (TensorFlow.js)
```
Input Layer (10-20 features):
- Current position (x, y)
- Current direction (dx, dy)
- Distance to walls (4 directions)
- Distance to opponent
- Opponent direction
- Safe spaces available (flood fill count)
- Trail density in nearby areas

Hidden Layers:
- Dense layer 1: 128 neurons, ReLU activation
- Dropout: 0.2
- Dense layer 2: 64 neurons, ReLU activation
- Dropout: 0.2
- Dense layer 3: 32 neurons, ReLU activation

Output Layer:
- 4 neurons (up, down, left, right)
- Softmax activation for probability distribution
```

#### Training Strategy
1. **Supervised Learning Phase**
   - Train on recorded human games
   - Focus on winning player decisions
   - Weight samples by game outcome quality

2. **Reinforcement Learning Phase**
   - Self-play with exploration
   - Reward shaping:
     - +1.0 for winning
     - -1.0 for losing
     - +0.1 for surviving longer
     - +0.05 for controlling more space

3. **Curriculum Learning**
   - Start with simple scenarios
   - Gradually increase complexity
   - Mix opponent strategies

### 3. Bot Implementation Levels

#### Easy Bot
```javascript
class EasyBot {
  - 70% random valid moves
  - 30% basic collision avoidance
  - No look-ahead
}
```

#### Medium Bot (Rule-Based)
```javascript
class MediumBot {
  - Flood fill algorithm for space evaluation
  - Basic minimax (2-3 moves ahead)
  - Wall hugging strategy
  - Opponent tracking
}
```

#### Hard Bot (ML-Powered)
```javascript
class HardBot {
  - Neural network predictions
  - Monte Carlo tree search for critical decisions
  - Dynamic strategy switching
  - Opponent modeling
}
```

#### Adaptive Bot
```javascript
class AdaptiveBot {
  - Tracks player win rate
  - Adjusts difficulty dynamically
  - Mixes strategies from different levels
  - Learns player patterns during session
}
```

### 4. Implementation Timeline

#### Phase 1: Foundation (Week 1)
- [ ] Refactor game for single-player mode
- [ ] Add game mode selection UI
- [ ] Implement basic bot with collision avoidance
- [ ] Create game recording system

#### Phase 2: Data Collection (Week 2)
- [ ] Add recording controls to UI
- [ ] Implement data export/import
- [ ] Create data preprocessing pipeline
- [ ] Build dataset from gameplay

#### Phase 3: ML Development (Week 3-4)
- [ ] Set up TensorFlow.js
- [ ] Implement neural network model
- [ ] Create training pipeline
- [ ] Develop model evaluation metrics

#### Phase 4: Bot Intelligence (Week 5)
- [ ] Implement flood fill algorithm
- [ ] Add minimax search
- [ ] Integrate ML model predictions
- [ ] Create difficulty level system

#### Phase 5: Refinement (Week 6)
- [ ] Implement self-play training
- [ ] Add adaptive difficulty
- [ ] Optimize performance
- [ ] Polish UI/UX

### 5. Technical Requirements

#### Dependencies
```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.x",
    "@tensorflow/tfjs-vis": "^1.x"
  }
}
```

#### File Structure
```
tron/
├── index.html           # Updated UI with game modes
├── css/
│   └── styles.css      # Extracted styles
├── js/
│   ├── tron.js         # Core game logic
│   ├── bot.js          # Bot implementations
│   ├── ml-model.js     # Neural network code
│   ├── recorder.js     # Game recording system
│   ├── trainer.js      # Model training logic
│   └── utils.js        # Helper functions
├── models/
│   ├── easy.json       # Pretrained models
│   ├── medium.json
│   └── hard.json
└── data/
    └── recordings/     # Recorded games
```

### 6. Key Algorithms

#### Flood Fill Space Evaluation
```javascript
function evaluateSpace(x, y, grid) {
  // Count reachable empty cells from position
  // Used to determine which player has more room
}
```

#### Minimax with Alpha-Beta Pruning
```javascript
function minimax(state, depth, alpha, beta, isMaximizing) {
  // Evaluate best move considering opponent's response
  // Prune branches that won't affect outcome
}
```

#### Feature Extraction for ML
```javascript
function extractFeatures(gameState) {
  return [
    normalizedPosition,
    wallDistances,
    opponentRelativePosition,
    trailDensity,
    availableSpace,
    // ... more features
  ];
}
```

### 7. Training Data Management

#### Data Collection Goals
- Minimum 1000 games for initial training
- Balance of different strategies
- Various game lengths and outcomes
- Player skill level diversity

#### Data Augmentation
- Rotate game boards (4 orientations)
- Mirror game boards (horizontal/vertical)
- Time-shift sequences
- Add noise for robustness

### 8. Performance Metrics

#### Bot Evaluation
- Win rate vs human players
- Average game length
- Decision time (<50ms target)
- Strategy diversity score
- Adaptation effectiveness

#### Model Metrics
- Prediction accuracy
- Loss convergence
- Validation performance
- Cross-entropy loss
- Move prediction confidence

### 9. User Interface Updates

#### New UI Elements
- Game mode selector (1P vs Bot, 2P vs Human, Training)
- Bot difficulty slider
- Recording indicator
- Training progress bar
- Statistics dashboard
- Model selection dropdown

#### Visual Feedback
- Bot thinking indicator
- Predicted move preview (debug mode)
- Space control visualization
- Decision confidence display

### 10. Advanced Features (Future)

#### Possible Extensions
- Online learning from player games
- Multiple bot personalities
- Tournament mode
- Replay system with analysis
- Bot vs bot competitions
- Custom bot training interface
- Move explanation system
- Strategy tutorial mode

## Success Criteria

1. **Playability**: Bot provides engaging challenge at all levels
2. **Learning**: Bot improves from recorded games
3. **Performance**: Smooth gameplay with <50ms decision time
4. **Adaptability**: Bot adjusts to player skill level
5. **Variety**: Different strategies emerge from training

## Testing Strategy

### Unit Tests
- Game mechanics
- Recording system
- Bot decision making
- Model predictions

### Integration Tests
- Full game loops
- Data pipeline
- Training process
- Difficulty transitions

### Performance Tests
- Frame rate stability
- Decision latency
- Memory usage
- Model inference speed

## Notes

- Consider using Web Workers for ML inference to avoid blocking main thread
- Implement progressive model loading for faster initial load
- Add telemetry for bot performance monitoring
- Consider privacy implications of recording games
- Provide option to disable ML features for performance-constrained devices