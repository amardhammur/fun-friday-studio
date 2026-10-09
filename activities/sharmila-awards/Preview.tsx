import { QuestionWheel } from './QuestionWheel';
import { starterQuestions } from './questions';
export function Preview() {
  return <div className="activity-art sa-art"><div className="art-grid"/><QuestionWheel questions={starterQuestions.slice(0, 8).map((text, i) => ({ id: String(i), text }))}/></div>;
}
