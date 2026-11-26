# PLP Survey — Content Inventory (verified against original Google Form)

**Source (authoritative):** <https://docs.google.com/forms/d/e/1FAIpQLSdOB12gVLmmamsogept8XAnw0sM5vCiJzghxnAHJSx8UamcOg/viewform>

**Form title:** PLP Survey 1 — Baseline (Beginning of Term 1)
**Owner:** Peace and Love Proclaimers
**Extracted:** 2026-11-25 — from the form's own `FB_PUBLIC_LOAD_DATA_` payload (complete, verbatim)

**Totals:** 33 payload items = 5 section blocks + 28 questions (27 required, 1 optional), **plus 1 built-in required Email field** (see below). Single-page form — no page breaks. School dropdown: 180 options, no "Other".

Machine-readable source of truth: `data/survey-source.json`. All survey code and seed data must be generated from that file — never retyped.

---

## Form header

> Peace and Love Proclaimers | PLP School Curriculum
> 
> This survey is filled in BEFORE the PLP program begins. It captures who you are right now — your confidence, your skills, your values. There are no right or wrong answers. Be completely honest. You will fill in a similar survey at the end of each term and at the end of the year so we can see how you have grown.
> 
> 🔒 Your answers are anonymous beyond your name and school. They will only be used to improve the PLP program.

## Confirmation message (after submit)

> Thank you! Your baseline survey has been submitted. Welcome to PLP. Lead with peace. Create with purpose. Thrive with opportunity.

---

## Built-in Email field (form setting, not a payload item)

The live form renders a **required `Email` field above `Full Name`**, with the checkbox label
`Record <email> as the email to be included with my response`.

This comes from Google Forms' built-in email-collection setting (`d[1][10][3] == 2`, verified mode),
**not** from the question payload — which is why it is not one of the 33 items above. It is still
real, required survey content and the application must capture a respondent email.

---

## Repeated 5-point scale

Used verbatim as the **answer options** for all 21 multiple-choice scale questions 
(idx 4–9, 11–15, 17–21, 23–27). Note `idx 2 Year Level` is also multiple-choice but is **not** a scale question:

- `1 — Strongly Disagree / Not at all`
- `2 — Disagree / A little`
- `3 — Neutral / Sometimes`
- `4 — Agree / Often`
- `5 — Strongly Agree / Always`

And used verbatim as the **help text** under each of those questions, and under the section blocks noted below:

> 1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always

---

## Item-by-item inventory

Order is the original form order. `idx` is the 0-based position in the source payload.

#### idx 0 — **REQUIRED**

- **Question (exact):** Full Name
- **Type:** short answer
- **Entry id:** `entry.1363545445`
- **Options:** *(free text)*

#### idx 1 — **REQUIRED**

- **Question (exact):** School Name
- **Type:** dropdown
- **Entry id:** `entry.392476008`
- **Help text (exact):** Please select your school from the list.
- **Options:** 180 options — full list in `data/survey-source.json` and in the appendix below

#### idx 2 — **REQUIRED**

- **Question (exact):** Year Level
- **Type:** multiple choice
- **Entry id:** `entry.672559437`
- **Options (exact, in order):** `S1`, `S2`, `S3`, `S4`, `S5`, `S6`


### Section block 1 — idx 3

**Title (exact):** SECTION A1 — Leadership Identity & Confidence

**Description (exact):**

> Answer honestly based on who you are RIGHT NOW, before the program begins.
> 
> 1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always

#### idx 4 — **REQUIRED**

- **Question (exact):** I see myself as a leader.
- **Type:** multiple choice
- **Entry id:** `entry.1250388049`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 5 — **REQUIRED**

- **Question (exact):** I believe my voice and opinions matter.
- **Type:** multiple choice
- **Entry id:** `entry.622497614`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 6 — **REQUIRED**

- **Question (exact):** I am confident speaking in front of a group.
- **Type:** multiple choice
- **Entry id:** `entry.1557927388`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 7 — **REQUIRED**

- **Question (exact):** I set goals for myself and work toward them.
- **Type:** multiple choice
- **Entry id:** `entry.2045282778`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 8 — **REQUIRED**

- **Question (exact):** I take initiative without waiting to be asked.
- **Type:** multiple choice
- **Entry id:** `entry.1923734074`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 9 — **REQUIRED**

- **Question (exact):** I can lead others even when it is difficult.
- **Type:** multiple choice
- **Entry id:** `entry.862335306`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*


### Section block 2 — idx 10

**Title (exact):** SECTION A2 — Skills & Knowledge

**Description (exact):** *(the repeated 5-point scale legend above, verbatim)*

#### idx 11 — **REQUIRED**

- **Question (exact):** I can communicate my ideas clearly to others.
- **Type:** multiple choice
- **Entry id:** `entry.2050294250`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 12 — **REQUIRED**

- **Question (exact):** I know how to research a topic and evaluate whether information is reliable.
- **Type:** multiple choice
- **Entry id:** `entry.1754423846`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 13 — **REQUIRED**

- **Question (exact):** I understand how to manage money and make a basic budget.
- **Type:** multiple choice
- **Entry id:** `entry.1967499013`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 14 — **REQUIRED**

- **Question (exact):** I can identify a problem in my community and think of solutions.
- **Type:** multiple choice
- **Entry id:** `entry.946747526`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 15 — **REQUIRED**

- **Question (exact):** I know how to write a project proposal.
- **Type:** multiple choice
- **Entry id:** `entry.848090481`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*


### Section block 3 — idx 16

**Title (exact):** SECTION A3 — Peace Values & Civic Responsibility

**Description (exact):** *(the repeated 5-point scale legend above, verbatim)*

#### idx 17 — **REQUIRED**

- **Question (exact):** I believe peace in my community is something I can contribute to.
- **Type:** multiple choice
- **Entry id:** `entry.21824051`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 18 — **REQUIRED**

- **Question (exact):** I understand why Rwanda's history matters to my generation.
- **Type:** multiple choice
- **Entry id:** `entry.1276040987`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 19 — **REQUIRED**

- **Question (exact):** I treat people from different backgrounds with respect and empathy.
- **Type:** multiple choice
- **Entry id:** `entry.2042551412`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 20 — **REQUIRED**

- **Question (exact):** I speak up when I see unfair or divisive behavior.
- **Type:** multiple choice
- **Entry id:** `entry.1881648513`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 21 — **REQUIRED**

- **Question (exact):** I feel responsible for the wellbeing of my community.
- **Type:** multiple choice
- **Entry id:** `entry.978166343`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*


### Section block 4 — idx 22

**Title (exact):** SECTION B — Starting Confidence

**Description (exact):**

> These questions are about how confident you feel RIGHT NOW. Some of these skills may be covered later in the PLP curriculum. There are no right or wrong answers.
> 
> 1 = Strongly Disagree / Not at all  |  2 = Disagree / A little  |  3 = Neutral / Sometimes  |  4 = Agree / Often  |  5 = Strongly Agree / Always

#### idx 23 — **REQUIRED**

- **Question (exact):** I feel confident finding reliable information when I need it.
- **Type:** multiple choice
- **Entry id:** `entry.610283415`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 24 — **REQUIRED**

- **Question (exact):** I feel confident managing my money and making a basic budget.
- **Type:** multiple choice
- **Entry id:** `entry.749611187`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 25 — **REQUIRED**

- **Question (exact):** I feel confident identifying a problem and thinking of a practical solution.
- **Type:** multiple choice
- **Entry id:** `entry.584554120`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 26 — **REQUIRED**

- **Question (exact):** I feel confident developing an idea into a simple project proposal.
- **Type:** multiple choice
- **Entry id:** `entry.325256702`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*

#### idx 27 — **REQUIRED**

- **Question (exact):** I feel confident handling disagreement or conflict in a constructive way.
- **Type:** multiple choice
- **Entry id:** `entry.324323319`
- **Help text:** *(repeated 5-point scale legend, verbatim)*
- **Options:** *(the 5-point scale above, verbatim — 5 options)*


### Section block 5 — idx 28

**Title (exact):** SECTION C — About You

**Description (exact):**

> A few open questions to help us understand your starting point. Take your time.

#### idx 29 — **REQUIRED**

- **Question (exact):** In your own words, what does it mean to be a leader?
- **Type:** paragraph
- **Entry id:** `entry.2090256807`
- **Options:** *(free text)*

#### idx 30 — **REQUIRED**

- **Question (exact):** What is one thing you hope PLP gives you this year?
- **Type:** paragraph
- **Entry id:** `entry.1283952506`
- **Options:** *(free text)*

#### idx 31 — **REQUIRED**

- **Question (exact):** What is your biggest personal goal for the next 12 months?
- **Type:** paragraph
- **Entry id:** `entry.852041322`
- **Options:** *(free text)*

#### idx 32 — *optional*

- **Question (exact):** Is there anything you are worried or unsure about as you start this program? (Optional)
- **Type:** paragraph
- **Entry id:** `entry.1661896947`
- **Options:** *(free text)*


---

## Verification record

Two independent passes, both on 2026-11-25:

1. **Payload pass** — parsed `FB_PUBLIC_LOAD_DATA_` from the form's served HTML (HTTP 200, 341,958 bytes).
   Yielded 33 items, types `{0,1,2,3,6}` only, zero page breaks.
2. **Render pass** — loaded the form in Chrome and read the fully rendered page text, then compared
   section titles, section descriptions, question wording, question order, every answer option, and
   every required marker against pass 1.

Result: **identical**, with one addition found only by the render pass — the built-in Email field
documented above.

The 180-option school list was verified byte-exact, not by eye: the live page and the saved
`data/survey-source.json` produce the same option count (180), the same joined character length
(3,892) and the same djb2-xor checksum (`1492274192`).

Nothing in the form was inaccessible. No question, option or wording is missing or guessed.

---

## Appendix — School Name dropdown (all 180 options, exact, in original order)

Required. No "Other" option. Spelling, casing, accents and punctuation are reproduced exactly as in the form.

1. ACEJ Karama
2. Acodes Mushishiro
3. Agahozo Shalom Youth Village
4. Akagera International School
5. Apaer Institute
6. APEFOC Gisenyi
7. Apeki Tumba
8. Apeki Tumba TSS
9. Bigogwe TSS
10. Blue lakes International School
11. Centre de jeunes Muert
12. Church Of God High School (St Patrick)
13. College Adec Ruhanga
14. College Apapec Remera Rukoma
15. College APPEKA Kabarondo TSS
16. College Baptist St Sylvestre de Kinigi
17. COLLEGE DE GISENYI INYEMERAMIHIGO
18. Collège de l'Immaculée Conception
19. COLLEGE DE LA PAIX
20. Collège de Rwankeri
21. College du Christ Roi de Nyanza
22. College Saint Andre
23. Collège Saint Ignace Mugina
24. College Sainte Marie Reine Kabgayi
25. College St Ignace Kamonyi
26. E.S Kabare / GS Kabare
27. E.S Kabarondo
28. E.S NYANGE
29. E.S st Alphonse Marie de liguori Mubuga
30. EAV Kivumu
31. Ecole de Lettres Gatovu
32. Ecole de science de Kidaho
33. Ecole de Science de Musanze
34. Ecole des science de Gisenyi (ESG)
35. Ecole des sciences Byimana
36. Ecole Secondaire Sancta Maria Karambo
37. Ecole secondaire elena guerra
38. Ecole secondaire Gafunzo
39. Ecole Secondaire Islamique de Ruhengeri
40. Ecole Secondaire Marie Adelaide
41. Ecole Secondaire Nyarugunga
42. Ecole Secondaire St Joseph Le travailleur
43. Ecole Secondaire St Vincent
44. Ecole Secondaire Stella Matutina
45. Ecole Secondary de Mushubi
46. Ecole Secondary RUKOMA SOPEM
47. Ecole Technique St Kizito
48. Ecole Tecnique de Kabgayi
49. EFOTEC
50. ENDP karubanda
51. ES BISESERO
52. ES GISHOMA
53. ES Kayonza Modern
54. Es Kigoma
55. ES KIRINDA
56. ES Marie Reine de la Paix
57. ES MUBUGA
58. ES MUHORORO
59. ES MUNZANGA SCHOOL
60. ES MURUNDA
61. ES RUGABANO
62. ES RUGANDA
63. ES Shangi
64. ES St Jean Bosco de Simbi
65. ESA Gisenyi
66. Eteka Muhanga
67. Eto Nyamata
68. EXCELLA
69. Fawe gahini
70. Fawe Gisozi
71. Forever TVET
72. G.S APAPEC Murambi
73. G.S APE Rugunga
74. G.S APRED Ndera
75. G.S BIHE / TSS
76. G.S BURINGO
77. G.S MUKONDO
78. G.S MWEGERA
79. G.S NDA NYUNDO
80. G.S RAMBURA (F)
81. G.S RAMBURA (G)
82. G.S RYABIZIGE TSS
83. G.S SANZARE SAINT ALOYS
84. G.S St Philippe Neri Gisagara
85. G.S ST.RAPHAEL RAMBURA
86. Gahogo Adventist Academy
87. Gashora Girls Academy
88. Gatsibo Tss
89. GIKONKO TSS
90. Glory academy
91. Green Hills Academy
92. Group scolaire Rilima
93. Groupe officielle de Butare
94. Groupe Scolaire Mater Dei
95. Groupe Scolaire Mère Du Verbe kibeho
96. Groupe Scolaire Saint Joseph Kabgayi
97. Groupe Scolaire Sainte Bernadette Save
98. GS BISUSA
99. GS BUNGWE
100. GS BUSIGARI
101. GS BWEYEYE
102. GS DIHIRO
103. GS GAHENGERI
104. GS GASUMO
105. GS GIHUNDWE
106. GS Gisozi
107. GS HANIKA
108. GS KABAYA
109. GS KAGOMBYI
110. GS KAMEMBE PRESBYTERIEN
111. Gs marie merci
112. GS MURIRA
113. GS Muzizi
114. GS Notre Dame du Bon Conseil Byumba
115. GS NYABIKERI
116. GS SAINT JOSEPH BIRAMBO
117. GS SAINT MATHIEU DE BUSASAMANA
118. GS SAINT PIERRE NKOMBO
119. GSCIM RWANKUBA
120. GSNDL Byimana
121. Hope Haven Secondary school
122. IFAK Don Bosco
123. Igihozo Saint Peter Secondary School
124. Inyange Girls School
125. IPRC Kigali Tss
126. Kabutare technical secondary school
127. Kagarama secondary school
128. Karenge Adventist Secondary School
129. Kibeho TSS
130. Kigali Excellent in Tourism and Hospitality Academy (KETHA)
131. King David Academy
132. Kivumu Tss
133. Kiziguro Secondary School
134. Lycee de Kicukiro Apade
135. Lycee de Kigali
136. Lycee de Nyanza
137. Lycée du Lac de Muhazi (ASPEJ)
138. Lycee Notre Dame de Citeaux
139. Lycee Notre Dame de la visitation rulindo
140. Maranyundo Girls School
141. Maryhill Girls Secondary School
142. Monseigneur Mubiligi Catholic TSS
143. Mother Mary School Complex
144. MTC Muhanga
145. Muhabura Integrated Polytechnic College
146. Muhanga Tss
147. NEGA gashora
148. Nelson Mandela TVET School
149. New Life Christian Academy
150. Ngoma Adventist College of Health Sciences
151. Nyagatare secondary school
152. Nyamata Highschool
153. Nyamugali Secondary School
154. Nyange Secondary School
155. Nyanza Tss
156. Nyundo School of Arts
157. Nyundo School of Music
158. PETIT SEMINAIRE SAINT PIE X DE NYUNDO
159. Pt Seminaire St Leo Kabgayi
160. Riviera High School
161. Runda TSS
162. Rwabuye TSS
163. Rwanda Coding Academy
164. Saint Bernadette Kamonyi
165. Saint Bernard Kansi
166. Saint Ignace TSS
167. Saint Ignatius High School Kibagabaga
168. Saint Kiziti Rwamagana
169. Saint Mary High School
170. saint Mary's high school kiruhura
171. Saint Sylvan Muranga
172. SOS THS
173. St Aloys
174. St Jean Murundi Secondary School
175. St Jean Nyarusange
176. St Peter School of Shyogwe
177. TTC DE LA SALLE BYUMBA
178. TTC Kabarore
179. TTC Nyamata
180. WORLD MISSION HIGH SCHOOL
