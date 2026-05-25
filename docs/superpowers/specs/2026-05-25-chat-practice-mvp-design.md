# Chat Practice MVP Design

## Product Positioning

This project is a local MVP for a Chinese WeChat-context chat training app. It helps men in their 20s who struggle to build natural relationships with women, especially when moving from ordinary conversation to familiarity, and from familiarity to light flirtation.

The product should feel like practicing with a realistic person rather than chatting with a generic bot. It focuses on healthy relationship skills: expression, listening, emotional attunement, boundaries, and natural progression. It may teach concrete progression skills, but it must not teach manipulation, pressure, harassment, or PUA-style tactics.

## Target User

The first target user is a single man in his 20s in mainland China who can start a conversation but often gets stuck when the chat becomes dull, repetitive, or ambiguous. He wants to become better at maintaining warmth, creating comfort, and gently testing romantic interest without becoming awkward, needy, aggressive, or oily.

## MVP Scope

The MVP is a local web app with real AI calls. It does not include login, payment, community, real-person matching, complex courses, voice messages, image messages, red packets, or full WeChat cloning.

The first version includes:

- Five high-quality persona cards.
- Free-form simulated chat.
- Hidden relationship state tracking.
- Optional hint button during chat.
- End-of-session review report.
- Local persistence for personas, chat records, state history, and review results.

## Core User Flow

1. The user selects a simulated person.
2. The app shows concise context: who she is, how the user knows her, current relationship stage, and recent chat status.
3. The user enters a WeChat-like chat screen and chats freely.
4. The AI replies according to the persona, recent messages, relationship state, and training goal.
5. The backend updates hidden relationship state after each user message.
6. The user can request optional guidance, but guidance does not appear by default.
7. The user ends the session after roughly 8-20 turns, or when the app suggests review.
8. The app generates a review report explaining what happened, why it happened, and what to do next.

## Training Goals

The first version focuses on two relationship stages:

- From ordinary chat to becoming more familiar.
- From familiarity to light flirtation.

Each session can have a hidden or explicit training goal such as:

- Make the conversation feel less like an interview.
- Recover warmth after the chat becomes flat.
- Build familiarity through self-disclosure and emotional response.
- Test light flirtation without pressuring the other person.
- Notice whether the other person is interested, polite, avoidant, or uncomfortable.

## Persona System

The MVP should start with five persona cards rather than many shallow personas:

1. A slow-warming but sincere woman of similar age.
2. An expressive woman who likes sharing daily life.
3. A busy woman with strong boundaries and career or study pressure.
4. An already familiar female friend.
5. A woman with mild ambiguous interest but uncertain attitude.

Each persona card includes:

- Basic background: age, work or study status, city, life rhythm.
- Personality style: outgoing or slow-warming, rational or emotional, active or passive, boundary strength.
- Chat habits: message length, emoji use, whether she asks questions back, whether she shares daily details.
- Relationship setup: how the user knows her, current relationship stage, recent chat temperature.
- Interests and sensitive areas: what she enjoys, what makes her withdraw, what kinds of questions feel intrusive.
- Current mood and context: tired after work, just exercised, weekend plans, exam pressure, and similar local context.

## Relationship State

The app tracks five hidden relationship indicators:

- Comfort: whether chatting feels relaxed and safe.
- Trust: whether she is willing to share more real information.
- Interest: whether the user feels interesting and worth continuing with.
- Ambiguity: whether there is light romantic tension or room for testing.
- Pressure: whether the user feels too eager, interrogative, needy, or boundary-crossing.

These scores are not shown during the chat by default. They are shown in the review report with explanations. This prevents users from optimizing for points instead of practicing realistic conversation.

State changes should be explainable. For example:

- Closed, interview-like questions reduce comfort and interest.
- Emotional reflection, relevant self-disclosure, and relaxed humor raise comfort and trust.
- Light teasing may raise ambiguity when trust and comfort are already high.
- Forced flirtation, repeated demands, sexual comments, or ignoring rejection raise pressure and cool the AI response.

## Chat Experience

The chat interface should suggest WeChat without trying to fully clone it. It includes:

- A top bar with persona nickname and relationship stage.
- Left-side bubbles for the AI persona.
- Right-side bubbles for the user.
- A text input and send button.
- A subtle hint button.
- A way to end the session and enter review.

The AI persona should not always cooperate. Depending on the user message and state, she may:

- Reply warmly.
- Reply briefly.
- Ask a question back.
- Share daily life.
- Dodge a topic.
- Change the subject.
- Become colder after pressure or boundary issues.
- Gently test the user if the relationship is warm enough.

The optional hint button should provide direction rather than a copy-paste answer. Example hint styles:

- "First respond to her feeling, then add one sentence from your own experience."
- "This is not a good moment to flirt. Make the chat easier first."
- "Ask a lighter follow-up instead of turning this into an interview."

## Review Report

The review report is the heart of the product. It should feel like a mature relationship coach: direct, specific, and non-shaming.

The report includes:

1. Current relationship judgment: a short summary of the state after this chat.
2. Relationship score changes: start and end values for comfort, trust, interest, ambiguity, and pressure, with reasons.
3. Key turning points: 2-4 important user messages that changed the direction of the chat.
4. Better alternatives: 1-2 improved versions for selected weak messages, with an explanation of why they are better.
5. Next-session goal: one concrete objective for the next chat.

The review should avoid insulting labels such as "low value", "simp", or "straight-man disease". It can say a message was too urgent, too interrogative, or too pressure-heavy, but it should explain the behavior and the repair path.

If the user attempts manipulation, coercion, sexual harassment, repeated pressure, or ignoring rejection, the review should clearly mark the boundary issue and redirect toward respectful communication. The app must not help convert harmful intent into more effective manipulation.

## Technical Architecture

The MVP is a local web app with a frontend and backend:

- Frontend: React with Vite for a single-page training experience.
- Backend: Node.js with Express.
- Storage: SQLite for personas, sessions, messages, state history, and reviews.
- AI: real model API configured through environment variables.

The initial stack is:

- React + Vite for the frontend.
- Express for the backend.
- SQLite for local structured persistence.

This keeps the frontend and backend easy to inspect while avoiding premature deployment complexity.

## Data Flow

1. User selects a persona.
2. Backend creates a training session.
3. Backend initializes hidden relationship state and session goal.
4. User sends a message.
5. Backend sends the persona card, recent chat history, current relationship state, and session goal to the AI.
6. AI returns a visible reply and structured hidden state updates.
7. Backend validates and stores the reply, message, state delta, and state reason.
8. Frontend displays only the visible reply.
9. User ends the session.
10. Backend sends the full transcript, persona, state history, and goal to the review model.
11. AI returns a structured review report.
12. Frontend displays the review.

## AI Output Contracts

Chat response should use structured JSON:

```json
{
  "reply": "visible message from the simulated person",
  "state_delta": {
    "comfort": 0,
    "trust": 0,
    "interest": 0,
    "ambiguity": 0,
    "pressure": 0
  },
  "state_reason": "brief reason for the state change",
  "boundary_flags": []
}
```

Review response should use structured JSON:

```json
{
  "summary": "overall relationship judgment",
  "scores": {
    "comfort": { "start": 50, "end": 58, "reason": "..." },
    "trust": { "start": 40, "end": 45, "reason": "..." },
    "interest": { "start": 45, "end": 43, "reason": "..." },
    "ambiguity": { "start": 20, "end": 24, "reason": "..." },
    "pressure": { "start": 15, "end": 18, "reason": "..." }
  },
  "turning_points": [
    {
      "user_message": "...",
      "impact": "...",
      "why": "..."
    }
  ],
  "better_versions": [
    {
      "original": "...",
      "better": "...",
      "why": "..."
    }
  ],
  "next_goal": "..."
}
```

The backend should validate the structure and fall back gracefully if parsing fails.

## Error Handling

The MVP should handle:

- Missing API key.
- Model call failure.
- Invalid model JSON.
- Empty user message.
- Missing or expired session.
- Storage read or write failure.

Errors should be clear and recoverable. For example, users should be able to retry a failed AI reply without losing the session.

## Acceptance Criteria

The MVP is acceptable when:

- The user can select one of five personas and start a session.
- The user can chat freely for 8-20 turns.
- Persona behavior remains stable within a session.
- The simulated person can warm up, cool down, dodge, ask back, or share based on the user's behavior.
- Hidden relationship scores change in ways that can be tied to concrete messages.
- The user can request optional hints.
- The user can end the session and receive a structured review.
- The review identifies relationship state, key turning points, better expressions, and next steps.
- Boundary-crossing behavior is cooled down in chat and clearly addressed in review.
- Sessions and reviews are saved locally.

## Non-Goals

The first version will not include:

- User accounts.
- Cloud sync.
- Payment.
- Deployment.
- Mobile native app.
- Real-person matching.
- Group chat.
- Voice messages.
- Image messages.
- Full WeChat feature cloning.
- A large course library.

## Open Implementation Decisions

These decisions can be made during implementation planning:

- Which AI provider and model to use first, as long as the backend keeps a replaceable AI adapter.
- Exact visual style of the chat screen.
- Exact score range and state clamping rules.
