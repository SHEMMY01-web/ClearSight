require('dotenv').config();
const { translateFullDocument } = require('./services/llm.service');

const text = `COMMUNITY INNOVATION HUB A brainchild of Teenpreneurs Educational Foundation
Plot 24, Adjacent Elibel School, Abesan Estate, Ipaja Lagos, Nigeria
Email: Teenpreneurshub@gmail.com
P h o n e N o: 07066 504 779, 0 7 0 6 3 5 7 6 9 11, +234 808 424 7660
23 RD January, 2026 OLAEWE SEMILORE VICTOR, Intern RE- OFFER LETTER I have been directed to convey the decision of the board of trustees at the meeting held on January 23 RD 2026, with respect to your form of interest for the role of an Intern (Volunteer) – Community Innovation Hub, and after a successful interview with the management team. Congratulations! You are now being confirmed as an INTERN for a period of six months (divided into two tracks- Jan/March and April/June) starting from January 26 TH 2026.`;

translateFullDocument(text).then(res => console.log("RESULT:\n", res)).catch(console.error);
