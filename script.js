// Global Constants
const API_KEY = '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';
const API_URL = 'https://api-inference.huggingface.co/models/';
const MODELS = {
    tutor: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    quiz: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    essay: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    career: 'mistralai/Mixtral-8x7B-Instruct-v0.1'
};

// Store the current quiz question and correct answer
let currentQuizQuestion = '';
let correctAnswer = '';

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('nav a');
    const sections = document.querySelectorAll('.section');
    const getStartedBtn = document.getElementById('get-started');
    const askTutorBtn = document.getElementById('ask-tutor');
    const generateQuizBtn = document.getElementById('generate-quiz');
    const checkAnswerBtn = document.getElementById('check-answer');
    const gradeEssayBtn = document.getElementById('grade-essay');
    const getCareersBtn = document.getElementById('get-careers');
    const errorModal = document.getElementById('error-modal');
    const closeModal = document.querySelector('.close-modal');
    const errorOkBtn = document.getElementById('error-ok');
    const loadingOverlay = document.getElementById('loading-overlay');

    initApp();

    function initApp() {
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                navLinks.forEach(item => item.classList.remove('active'));
                this.classList.add('active');
                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === targetId) section.classList.add('active');
                });
            });
        });

        getStartedBtn.addEventListener('click', () => {
            document.querySelector('nav a[href="#ai-tutor"]').click();
        });

        askTutorBtn.addEventListener('click', handleTutorQuestion);
        generateQuizBtn.addEventListener('click', handleQuizGeneration);
        checkAnswerBtn.addEventListener('click', handleAnswerCheck);
        gradeEssayBtn.addEventListener('click', handleEssayGrading);
        getCareersBtn.addEventListener('click', handleCareerRecommendation);

        closeModal.addEventListener('click', () => errorModal.classList.add('hidden'));
        errorOkBtn.addEventListener('click', () => errorModal.classList.add('hidden'));
    }

    // Helper Functions
    function showLoading() { loadingOverlay.classList.remove('hidden'); }
    function hideLoading() { loadingOverlay.classList.add('hidden'); }
    function showError(message) {
        document.getElementById('error-message').textContent = message || 'Something went wrong.';
        errorModal.classList.remove('hidden');
    }

    async function makeAPIRequest(model, inputText, options = {}, retries = 3) {
        showLoading();
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(`${API_URL}${model}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        inputs: inputText,
                        parameters: { 
                            max_length: options.max_length || 400,
                            min_length: 50,
                            temperature: options.temperature || 0.6,
                            top_p: options.top_p || 0.95,
                            repetition_penalty: 1.3
                        },
                        ...options
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API failed: ${response.status}`);
                }

                const result = await response.json();
                console.log('Raw API Response for', model, ':', result);
                return result;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error.message);
                if (attempt === retries) {
                    if (error.message.includes('401')) {
                        showError('Invalid API key. Grab a new one from Hugging Face.');
                    } else if (error.message.includes('429')) {
                        showError('Rate limit hit. Chill for a sec and retry.');
                    } else if (error.message.includes('503') || error.message.includes('busy')) {
                        showError('Server’s slammed or down. Try again soon.');
                    } else if (error.message.includes('network')) {
                        showError('Network’s jacked. Check your connection.');
                    } else {
                        showError(`Error: ${error.message}`);
                    }
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
            } finally {
                hideLoading();
            }
        }
    }

    function formatResponse(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    // Tutor Handler
    async function handleTutorQuestion() {
        const questionInput = document.getElementById('tutor-question');
        const responseArea = document.getElementById('tutor-response');
        const question = questionInput.value.trim();

        if (!question) {
            showError('Please enter a question.');
            return;
        }

        responseArea.innerHTML = '<div class="loading-indicator">Thinking...</div>';

        const prompt = `[INST] As an expert tutor, provide a clear, accurate answer to: "${question}". If it asks for steps, list them as 1., 2., etc. Keep it concise, no repetition. [/INST]`;
        const result = await makeAPIRequest(MODELS.tutor, prompt);

        if (result) {
            let response = result[0]?.generated_text || result.generated_text || JSON.stringify(result);
            response = response.replace(prompt, '').trim();
            const lines = response.split('\n').filter((line, index, self) => 
                line.trim() && self.indexOf(line) === index
            );
            response = lines.join('\n');
            responseArea.innerHTML = formatResponse(response || 'No clear answer generated.');
        } else {
            responseArea.innerHTML = '<div class="error-message">Couldn’t process your question. Check console.</div>';
        }
    }

    // Quiz Generator Handler
    async function handleQuizGeneration() {
        const topicInput = document.getElementById('quiz-topic');
        const questionArea = document.getElementById('quiz-question');
        const answerSection = document.getElementById('quiz-answer-section');
        const topic = topicInput.value.trim() || 'general knowledge';

        questionArea.innerHTML = '<div class="loading-indicator">Generating quiz question...</div>';
        answerSection.classList.add('hidden');

        const randomNudge = Math.floor(Math.random() * 1000);
        const prompt = `[INST] Generate a unique multiple-choice quiz question about "${topic}" (variation ${randomNudge}). Use this format:\n` +
                      `Question: [A specific question about ${topic}]\n` +
                      `A) [Option 1]\n` +
                      `B) [Option 2]\n` +
                      `C) [Option 3]\n` +
                      `D) [Option 4]\n` +
                      `Correct Answer: [A, B, C, or D]\n` +
                      `Explanation: [Brief explanation of why]\n` +
                      `Output the full question with options, then the correct answer and explanation on new lines.` +
                      `[/INST]`;
        const result = await makeAPIRequest(MODELS.quiz, prompt, { 
            max_length: 400,
            temperature: 0.9,
            top_p: 0.99
        });

        if (result) {
            let fullText = result[0]?.generated_text || result.generated_text || JSON.stringify(result);
            fullText = fullText.replace(prompt, '').trim();
            
            const lines = fullText.split('\n');
            const questionLines = lines.slice(0, 5);
            const answerLine = lines.find(line => line.startsWith('Correct Answer:'));
            const explanationLine = lines.find(line => line.startsWith('Explanation:'));

            currentQuizQuestion = questionLines.join('\n');
            correctAnswer = answerLine ? answerLine.replace('Correct Answer: ', '').trim() : 'B';
            const explanation = explanationLine ? explanationLine.replace('Explanation: ', '').trim() : 'No explanation provided.';

            questionArea.innerHTML = formatResponse(currentQuizQuestion);
            answerSection.classList.remove('hidden');
            resetRadioButtons();

            console.log('Stored Correct Answer:', correctAnswer);
            console.log('Stored Explanation:', explanation);
        } else {
            questionArea.innerHTML = '<div class="error-message">Couldn’t generate a quiz question.</div>';
        }
    }

    // Reset Radio Buttons
    function resetRadioButtons() {
        const radios = document.querySelectorAll('input[name="quiz-answer"]');
        radios.forEach(radio => {
            radio.checked = false;
        });
        document.getElementById('answer-feedback').innerHTML = '';
        document.getElementById('answer-feedback').classList.add('hidden');
    }

    // Answer Check Handler
    async function handleAnswerCheck() {
        const quizQuestion = currentQuizQuestion;
        const selectedAnswer = document.querySelector('input[name="quiz-answer"]:checked');
        const feedbackArea = document.getElementById('answer-feedback');

        if (!selectedAnswer) {
            showError('Pick an answer, bro!');
            return;
        }

        const userAnswer = selectedAnswer.value;
        feedbackArea.innerHTML = '<div class="loading-indicator">Checking...</div>';
        feedbackArea.classList.remove('hidden');

        if (userAnswer === correctAnswer) {
            const prompt = `[INST] For this quiz question:\n"${quizQuestion}"\n` +
                          `The user picked: ${userAnswer}, which matches the correct answer ${correctAnswer}.\n` +
                          `Provide a brief, accurate explanation why it’s right, starting directly with the reason. Example: "The return type of main is int per C standards." [/INST]`;
            const result = await makeAPIRequest(MODELS.quiz, prompt);
            let feedback = result ? (result[0]?.generated_text || result.generated_text || JSON.stringify(result)).replace(prompt, '').trim() : `The answer is ${correctAnswer}.`;
            feedback = feedback.replace(/^Correct\.?\s*/i, '').trim();
            feedbackArea.innerHTML = '<span class="correct">Correct</span> ' + formatResponse(feedback);
        } else {
            const prompt = `[INST] For this quiz question:\n"${quizQuestion}"\n` +
                          `The user picked: ${userAnswer}, but the correct answer is ${correctAnswer}.\n` +
                          `Provide a brief, accurate explanation why the user’s pick is wrong, starting directly with the reason. Example: "The correct answer is B) int because main must return an integer in C." [/INST]`;
            const result = await makeAPIRequest(MODELS.quiz, prompt);
            let feedback = result ? (result[0]?.generated_text || result.generated_text || JSON.stringify(result)).replace(prompt, '').trim() : `The correct answer is ${correctAnswer}.`;
            feedback = feedback.replace(/^Wrong\.?\s*/i, '').trim();
            feedbackArea.innerHTML = '<span class="wrong">Wrong</span> ' + formatResponse(feedback);
        }
    }

    // Essay Grading Handler
    async function handleEssayGrading() {
        const essayText = document.getElementById('essay-text').value.trim();
        const subject = document.getElementById('essay-subject').value;
        const gradeLevel = document.getElementById('grade-level').value;
        const feedbackArea = document.getElementById('essay-feedback');

        if (essayText.length < 100) {
            showError('Essay must be at least 100 characters.');
            return;
        }

        feedbackArea.innerHTML = '<div class="loading-indicator">Analyzing your essay...</div>';

        const context = `${subject ? 'Subject: ' + subject : ''}${gradeLevel ? '\nGrade level: ' + gradeLevel : ''}`;
        const prompt = `[INST] Analyze this essay and provide structured feedback:\n${context}\n\nEssay: "${essayText}"\n\n` +
                      `Return feedback strictly in this format:\n` +
                      `Strengths: [List specific strengths, e.g., "Clear thesis statement"]\n` +
                      `Areas for Improvement: [List specific areas, e.g., "Needs more evidence"]\n` +
                      `Grade: [Letter grade like A-, B+, etc., based on ${gradeLevel || 'general'} standards]\n` +
                      `Do not deviate from this format. Be concise and specific. [/INST]`;
        const result = await makeAPIRequest(MODELS.essay, prompt, { 
            max_length: 600,
            temperature: 0.7,
            top_p: 0.95
        });

        if (result) {
            let feedback = result[0]?.generated_text || result.generated_text || JSON.stringify(result);
            feedback = feedback.replace(prompt, '').trim();
            feedbackArea.innerHTML = formatEssayFeedback(feedback || 'No feedback generated.');
        } else {
            feedbackArea.innerHTML = '<div class="error-message">Couldn’t analyze your essay.</div>';
        }
    }

    function formatEssayFeedback(feedback) {
        const sections = [
            { label: 'Strengths', regex: /Strengths:[\s\S]*?(?=Areas for Improvement:|Grade:|$)/i },
            { label: 'Areas for Improvement', regex: /Areas for Improvement:[\s\S]*?(?=Grade:|$)/i },
            { label: 'Grade', regex: /Grade:[\s\S]*?$/i }
        ];

        let html = '<div class="essay-feedback-content">';
        let remaining = feedback;

        sections.forEach(section => {
            const match = remaining.match(section.regex);
            if (match) {
                let content = match[0].replace(section.label + ':', '').trim();
                if (section.label !== 'Grade' && content && !content.startsWith('<ul>')) {
                    content = '<ul class="feedback-list"><li>' + content.split('\n').join('</li><li>') + '</li></ul>';
                }
                html += `<div class="feedback-section">
                    <h4>${section.label}</h4>
                    <div class="feedback-text">${formatResponse(content)}</div>
                </div>`;
                remaining = remaining.replace(match[0], '');
            } else {
                html += `<div class="feedback-section">
                    <h4>${section.label}</h4>
                    <div class="feedback-text">${section.label === 'Grade' ? 'Not provided' : 'None identified'}</div>
                </div>`;
            }
        });

        if (remaining.trim()) {
            html += `<div class="feedback-section">
                <h4>Additional Feedback</h4>
                <div class="feedback-text">${formatResponse(remaining.trim())}</div>
            </div>`;
        }

        html += '</div>';
        return html;
    }

    // Career Recommendation Handler (Fixed)
    async function handleCareerRecommendation() {
        const interestsInput = document.getElementById('career-interests').value.trim();
        const resultsArea = document.getElementById('career-results');

        if (!interestsInput) {
            showError('Please enter your interests.');
            return;
        }

        resultsArea.innerHTML = '<div class="loading-indicator">Analyzing your interests...</div>';

        const careers = [];
        let attempt = 0;
        const maxAttempts = 10; // Safety limit to avoid infinite loop

        while (careers.length < 5 && attempt < maxAttempts) {
            attempt++;
            const prompt = `[INST] Based on the interests: "${interestsInput}", suggest a single unique career (attempt ${attempt}). Consider all listed interests and blend them where possible. Use this exact bullet-point format:\n` +
                          `${careers.length + 1}. [Career Name]\n` +
                          `   - Description: [A concise description of the career]\n` +
                          `   - Education: [Specific education or training required]\n` +
                          `   - Salary: [Estimated salary range, e.g., $50,000 - $70,000]\n` +
                          `Ensure the career is distinct from: ${careers.map(c => c.split('\n')[0]).join(', ') || 'none yet'}. Provide only one career, fully detailed. [/INST]`;
            const result = await makeAPIRequest(MODELS.career, prompt, {
                max_length: 400,
                temperature: 0.7,
                top_p: 0.95
            });

            if (result) {
                let careerText = result[0]?.generated_text || result.generated_text || JSON.stringify(result);
                careerText = careerText.replace(prompt, '').trim();
                // Validate the response has all required parts
                if (careerText && 
                    careerText.includes('- Description:') && 
                    careerText.includes('- Education:') && 
                    careerText.includes('- Salary:')) {
                    careers.push(careerText);
                } else {
                    console.log(`Invalid career response (attempt ${attempt}):`, careerText);
                }
            } else {
                console.log(`API failed on attempt ${attempt}`);
            }
        }

        if (careers.length < 5) {
            showError(`Could only generate ${careers.length} valid careers after ${maxAttempts} attempts.`);
        }

        const combinedRecommendations = careers.join('\n\n');
        console.log('Combined Career Recommendations:', combinedRecommendations);
        resultsArea.innerHTML = formatCareerRecommendations(combinedRecommendations || 'No recommendations generated.');
    }

    function formatCareerRecommendations(recommendations) {
        const careers = recommendations.split(/\d+\.\s+/).filter(Boolean);
        let html = '<div class="career-recommendations">';

        // Only take the first 5 valid careers
        careers.slice(0, 5).forEach((career, index) => {
            html += `<div class="career-option">
                <h4>Career ${index + 1}</h4>
                <div>${formatResponse(career.trim())}</div>
            </div>`;
        });

        html += '</div>';
        return html;
    }
});
