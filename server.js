const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cors = require('cors');

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(cors());

app.post('/generate', async (req, res) => {
    const { prompt } = req.body;
    let hasSentResponse = false;

    try {
        const responseStream = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'dolphin-mistral',
                prompt: prompt
            })
        });

        let fullResponse = '';
        let buffer = '';

        responseStream.body.on('data', (chunk) => {
            if (hasSentResponse) return; // Prevent sending multiple responses

            buffer += chunk.toString();
            let parts = buffer.split('\n');
            buffer = parts.pop(); // The last part might be incomplete, so save it for next time

            for (let part of parts) {
                if (part.trim() !== '') {
                    try {
                        const data = JSON.parse(part);
                        if (data.response) {
                            fullResponse += data.response;
                        }
                        if (data.done === true) {
                            // If this is the last chunk, send the response
                            hasSentResponse = true;
                            res.json({ response: fullResponse });
                            return;
                        }
                    } catch (parseError) {
                        // Log parsing errors but continue processing
                        console.error('Error parsing JSON:', parseError);
                    }
                }
            }
        });

        responseStream.body.on('end', () => {
            if (!hasSentResponse) {
                if (fullResponse === '') {
                    // If no response was collected, send an error
                    res.status(500).json({ error: 'Failed to generate response' });
                } else {
                    // This should not happen if 'done' was true, but just in case
                    res.json({ response: fullResponse });
                }
            }
        });

        responseStream.body.on('error', (err) => {
            if (!hasSentResponse) {
                console.error('Error in response stream:', err);
                res.status(500).json({ error: 'Failed to generate response' });
            }
        });

    } catch (error) {
        if (!hasSentResponse) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Failed to generate response' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});