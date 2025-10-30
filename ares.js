// ARES AI BOT - Machine Learning Powered Opponent
// ================================================

class AresBot {
    constructor() {
        this.model = null;
        this.weights = null;
        this.isReady = false;
        this.decisionHistory = [];
        this.survivalTime = 0;
        this.deathCause = null;

        // Neural network configuration
        this.config = {
            inputSize: 20,
            hiddenLayers: [64, 32],
            outputSize: 4, // up, down, left, right
            learningRate: 0.001
        };

        // Initialize the model
        this.initializeModel();
    }

    async initializeModel() {
        try {
            // Load existing model from server
            const response = await fetch('http://localhost:3000/api/model');
            const modelData = await response.json();

            if (modelData.weights && modelData.weights.hidden1) {
                this.weights = modelData.weights;
                console.log('Loaded existing Ares AI model with trained weights');
            } else {
                // Initialize random weights if no saved model
                this.initializeRandomWeights();
                console.log('Initialized new Ares AI model with random weights');
            }

            this.config = modelData.config || this.config;
            this.isReady = true;
        } catch (error) {
            console.log('Could not load model from server, initializing with random weights');
            this.initializeRandomWeights();
            this.isReady = true;
        }
    }

    initializeRandomWeights() {
        this.weights = {
            hidden1: this.createRandomMatrix(this.config.inputSize, this.config.hiddenLayers[0]),
            hidden1Bias: this.createRandomVector(this.config.hiddenLayers[0]),
            hidden2: this.createRandomMatrix(this.config.hiddenLayers[0], this.config.hiddenLayers[1]),
            hidden2Bias: this.createRandomVector(this.config.hiddenLayers[1]),
            output: this.createRandomMatrix(this.config.hiddenLayers[1], this.config.outputSize),
            outputBias: this.createRandomVector(this.config.outputSize)
        };
    }

    createRandomMatrix(rows, cols) {
        const matrix = [];
        const scale = Math.sqrt(2.0 / rows); // Xavier initialization
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = (Math.random() * 2 - 1) * scale;
            }
        }
        return matrix;
    }

    createRandomVector(size) {
        const vector = [];
        const scale = Math.sqrt(2.0 / size);
        for (let i = 0; i < size; i++) {
            vector[i] = (Math.random() * 2 - 1) * scale;
        }
        return vector;
    }

    // Extract features from the game state
    extractFeatures(gameState) {
        const features = [];
        const { x, y, dx, dy, grid, playerX, playerY, playerDx, playerDy } = gameState;

        // Normalize positions (0 to 1)
        const gridSize = grid.length;
        features.push(x / gridSize, y / gridSize);

        // Current direction (one-hot encoded)
        features.push(dx === 1 ? 1 : 0); // right
        features.push(dx === -1 ? 1 : 0); // left
        features.push(dy === 1 ? 1 : 0); // down
        features.push(dy === -1 ? 1 : 0); // up

        // Distance to walls (normalized)
        features.push(x / gridSize); // distance to left wall
        features.push((gridSize - x) / gridSize); // distance to right wall
        features.push(y / gridSize); // distance to top wall
        features.push((gridSize - y) / gridSize); // distance to bottom wall

        // Look ahead distances (how many cells until collision)
        features.push(this.lookAheadDistance(x, y, 1, 0, grid) / gridSize); // right
        features.push(this.lookAheadDistance(x, y, -1, 0, grid) / gridSize); // left
        features.push(this.lookAheadDistance(x, y, 0, 1, grid) / gridSize); // down
        features.push(this.lookAheadDistance(x, y, 0, -1, grid) / gridSize); // up

        // Player relative position (normalized)
        features.push((playerX - x) / gridSize);
        features.push((playerY - y) / gridSize);

        // Player direction
        features.push(playerDx, playerDy);

        // Available space estimation (flood fill would be expensive, so use simple heuristic)
        features.push(this.estimateAvailableSpace(x, y, grid) / (gridSize * gridSize));

        // Danger level (how many occupied cells nearby)
        features.push(this.calculateDangerLevel(x, y, grid));

        // Ensure we have exactly inputSize features
        while (features.length < this.config.inputSize) {
            features.push(0);
        }

        return features.slice(0, this.config.inputSize);
    }

    lookAheadDistance(x, y, dx, dy, grid) {
        let distance = 0;
        let currentX = x + dx;
        let currentY = y + dy;

        while (currentX >= 0 && currentX < grid.length &&
               currentY >= 0 && currentY < grid.length &&
               !grid[currentY][currentX]) {
            distance++;
            currentX += dx;
            currentY += dy;
        }

        return distance;
    }

    estimateAvailableSpace(x, y, grid) {
        // Simple estimation: count empty cells in a 10x10 area around position
        let emptyCount = 0;
        const radius = 5;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;

                if (checkX >= 0 && checkX < grid.length &&
                    checkY >= 0 && checkY < grid.length &&
                    !grid[checkY][checkX]) {
                    emptyCount++;
                }
            }
        }

        return emptyCount;
    }

    calculateDangerLevel(x, y, grid) {
        // Check immediate surrounding cells
        let occupiedCount = 0;
        const positions = [
            [x + 1, y], [x - 1, y],
            [x, y + 1], [x, y - 1],
            [x + 1, y + 1], [x - 1, y - 1],
            [x + 1, y - 1], [x - 1, y + 1]
        ];

        for (const [checkX, checkY] of positions) {
            if (checkX >= 0 && checkX < grid.length &&
                checkY >= 0 && checkY < grid.length &&
                grid[checkY][checkX]) {
                occupiedCount++;
            }
        }

        return occupiedCount / 8; // Normalize to 0-1
    }

    // Forward pass through the neural network
    forward(features) {
        // Hidden layer 1
        let hidden1 = this.matrixVectorMultiply(this.weights.hidden1, features);
        hidden1 = this.vectorAdd(hidden1, this.weights.hidden1Bias);
        hidden1 = this.relu(hidden1);

        // Hidden layer 2
        let hidden2 = this.matrixVectorMultiply(this.weights.hidden2, hidden1);
        hidden2 = this.vectorAdd(hidden2, this.weights.hidden2Bias);
        hidden2 = this.relu(hidden2);

        // Output layer
        let output = this.matrixVectorMultiply(this.weights.output, hidden2);
        output = this.vectorAdd(output, this.weights.outputBias);

        // Apply softmax for probability distribution
        return this.softmax(output);
    }

    matrixVectorMultiply(matrix, vector) {
        const result = [];
        for (let i = 0; i < matrix.length; i++) {
            let sum = 0;
            for (let j = 0; j < vector.length; j++) {
                sum += matrix[i][j] * vector[j];
            }
            result.push(sum);
        }
        return result;
    }

    vectorAdd(a, b) {
        return a.map((val, i) => val + b[i]);
    }

    relu(vector) {
        return vector.map(val => Math.max(0, val));
    }

    softmax(vector) {
        const max = Math.max(...vector);
        const exp = vector.map(val => Math.exp(val - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(val => val / sum);
    }

    // Make a decision based on the current game state
    makeDecision(gameState) {
        if (!this.isReady) {
            // Fallback to simple avoidance if model not ready
            return this.simpleAvoidance(gameState);
        }

        // Extract features from game state
        const features = this.extractFeatures(gameState);

        // Get neural network output
        const outputs = this.forward(features);

        // Add exploration (epsilon-greedy) - decreases over time
        const gamesPlayed = this.getGamesPlayedCount();
        const epsilon = Math.max(0.05, 0.1 - (gamesPlayed * 0.01)); // 10% to 5%
        if (Math.random() < epsilon) {
            return this.getRandomValidMove(gameState);
        }

        // Get valid moves
        const validMoves = this.getValidMoves(gameState);

        // Map outputs to moves and filter valid ones
        const moves = ['right', 'left', 'down', 'up'];
        const moveProbs = moves.map((move, i) => ({
            move: move,
            prob: outputs[i],
            valid: validMoves.includes(move)
        }));

        // Sort by probability and get best valid move
        moveProbs.sort((a, b) => b.prob - a.prob);
        const bestMove = moveProbs.find(m => m.valid);

        if (bestMove) {
            // Record decision for training
            this.decisionHistory.push({
                features: features,
                action: moves.indexOf(bestMove.move),
                timestamp: Date.now()
            });

            return bestMove.move;
        }

        // Fallback if no valid moves
        return this.simpleAvoidance(gameState);
    }

    getValidMoves(gameState) {
        const { x, y, dx, dy, grid } = gameState;
        const validMoves = [];

        // Check each direction
        if (x + 1 < grid.length && !grid[y][x + 1] && dx !== -1) {
            validMoves.push('right');
        }
        if (x - 1 >= 0 && !grid[y][x - 1] && dx !== 1) {
            validMoves.push('left');
        }
        if (y + 1 < grid.length && !grid[y + 1][x] && dy !== -1) {
            validMoves.push('down');
        }
        if (y - 1 >= 0 && !grid[y - 1][x] && dy !== 1) {
            validMoves.push('up');
        }

        return validMoves;
    }

    getRandomValidMove(gameState) {
        const validMoves = this.getValidMoves(gameState);
        if (validMoves.length === 0) return null;
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    // Simple collision avoidance as fallback
    simpleAvoidance(gameState) {
        const { x, y, dx, dy, grid } = gameState;

        // Look ahead in current direction
        const nextX = x + dx;
        const nextY = y + dy;

        // If current direction is safe, continue
        if (nextX >= 0 && nextX < grid.length &&
            nextY >= 0 && nextY < grid.length &&
            !grid[nextY][nextX]) {
            // 70% chance to continue straight for more natural movement
            if (Math.random() < 0.7) {
                return null; // Continue in current direction
            }
        }

        // Find the safest direction
        const validMoves = this.getValidMoves(gameState);
        if (validMoves.length === 0) return null;

        // Prefer moves that give more space
        let bestMove = validMoves[0];
        let maxDistance = 0;

        for (const move of validMoves) {
            let distance = 0;
            switch (move) {
                case 'right':
                    distance = this.lookAheadDistance(x, y, 1, 0, grid);
                    break;
                case 'left':
                    distance = this.lookAheadDistance(x, y, -1, 0, grid);
                    break;
                case 'down':
                    distance = this.lookAheadDistance(x, y, 0, 1, grid);
                    break;
                case 'up':
                    distance = this.lookAheadDistance(x, y, 0, -1, grid);
                    break;
            }

            if (distance > maxDistance) {
                maxDistance = distance;
                bestMove = move;
            }
        }

        return bestMove;
    }

    // Record death information for training
    recordDeath(cause, finalGameState) {
        this.deathCause = cause; // 'wall', 'own_trail', 'enemy_trail'
        this.survivalTime = Date.now() - (this.decisionHistory[0]?.timestamp || Date.now());

        // Calculate rewards for decisions based on outcome
        const rewardDecay = 0.9; // Recent decisions matter more
        const baseReward = cause === 'win' ? 1.0 : -1.0;

        for (let i = this.decisionHistory.length - 1; i >= 0; i--) {
            const decay = Math.pow(rewardDecay, this.decisionHistory.length - 1 - i);
            this.decisionHistory[i].reward = baseReward * decay;
        }
    }

    // Get training data for model update
    getTrainingData() {
        return {
            decisions: this.decisionHistory,
            survivalTime: this.survivalTime,
            deathCause: this.deathCause
        };
    }

    // Update weights based on training data (simplified backpropagation)
    updateWeights(trainingData) {
        if (!trainingData || trainingData.length === 0) return;

        const learningRate = this.config.learningRate;

        for (const sample of trainingData) {
            if (!sample.features || !sample.reward) continue;

            // Forward pass to get current prediction
            const prediction = this.forward(sample.features);

            // Create target (reward-weighted action)
            const target = [0, 0, 0, 0];
            target[sample.action] = sample.reward;

            // Simplified gradient update for output layer
            const outputError = target.map((t, i) => t - prediction[i]);

            // Update output weights (simplified)
            for (let i = 0; i < this.weights.output.length; i++) {
                for (let j = 0; j < this.weights.output[i].length; j++) {
                    this.weights.output[i][j] += learningRate * outputError[j] * sample.features[i];
                }
            }

            // Update output bias
            for (let i = 0; i < this.weights.outputBias.length; i++) {
                this.weights.outputBias[i] += learningRate * outputError[i];
            }
        }
    }

    // Get games played count for epsilon calculation
    getGamesPlayedCount() {
        // This would ideally come from server, but for now use a simple heuristic
        return this.decisionHistory.length > 0 ? Math.floor(Date.now() / 10000) % 100 : 0;
    }

    // Reset for new game
    reset() {
        this.decisionHistory = [];
        this.survivalTime = 0;
        this.deathCause = null;
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AresBot;
}