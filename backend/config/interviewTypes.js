const INTERVIEW_TYPES = {
  dsa:               { label: 'DSA',                 description: 'Data Structures & Algorithms',             color: '#3b82f6', baseType: 'dsa' },
  systemDesign:      { label: 'System Design',       description: 'Scalable System Architecture',             color: '#8b5cf6', baseType: 'systemDesign' },
  lld:               { label: 'LLD',                 description: 'Low-Level / OOP Design',                   color: '#10b981', baseType: 'lld' },
  managerial:        { label: 'Managerial',          description: 'Behavioral and cultural fit interview',    color: '#f43f5e', baseType: 'managerial' },
  tutorDsa:          { label: 'DSA Tutor',           description: 'Learn DSA with guided teaching',           color: '#f59e0b', baseType: 'dsa', isTutor: true },
  tutorLld:          { label: 'LLD Tutor',           description: 'Learn OOP Design with guided teaching',    color: '#06b6d4', baseType: 'lld', isTutor: true },
  tutorSystemDesign: { label: 'System Design Tutor', description: 'Learn System Design with guided teaching', color: '#ec4899', baseType: 'systemDesign', isTutor: true },
};

const VALID_INTERVIEW_TYPES = Object.keys(INTERVIEW_TYPES);

function baseTypeOf(interviewType) {
  return INTERVIEW_TYPES[interviewType]?.baseType || 'dsa';
}

module.exports = { INTERVIEW_TYPES, VALID_INTERVIEW_TYPES, baseTypeOf };
