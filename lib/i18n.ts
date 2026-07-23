export type Lang = 'en' | 'zh';

export const STR = {
  eyebrow: { en: 'The Round Table', zh: '圆桌会议' },
  h1: { en: 'Is your problem worth solving?', zh: '你的问题值得解决吗？' },
  subtitle: {
    en: 'Three role-specialized agents — Market, Builder, Investor — debate your idea, then align on one shared recommendation. The original disagreement stays visible if you want to see how they got there.',
    zh: '市场、构建者与投资人三位角色化智能体审视你的想法，随后收敛为一条共同建议。原始分歧依然可见，供你了解结论是如何得出的。',
  },
  ideaPh: { en: 'Describe your idea, problem, or early concept. The more context you give, the sharper the debate.', zh: '描述你的想法、问题或早期概念。给的背景越多，辩论越锋利。' },
  attach: { en: '📎 Attach notes (.txt / .md / .pdf / .docx)', zh: '📎 附加笔记 (.txt / .md / .pdf / .docx)' },
  parsing: { en: 'reading…', zh: '读取中…' },
  seat: { en: 'Seat the table →', zh: '入席圆桌 →' },
  clear: { en: 'Clear', zh: '清空' },
  consent1: { en: 'AI can make mistakes. Please double-check responses.', zh: 'AI 可能出错，请自行核实回答内容。' },
  consent2: { en: 'Your input may be used to improve our product.', zh: '你的输入可能被用于改进我们的产品。' },
  rail1: { en: 'Debate', zh: '辩论' }, rail2: { en: 'Your turn', zh: '轮到你' }, rail3: { en: 'They react', zh: '顾问回应' },
  sideTitle: { en: 'Your path', zh: '流程' },
  sDescribe: { en: 'Describe your idea', zh: '描述你的想法' },
  sDebate: { en: 'The table debates', zh: '圆桌辩论' },
  sTurn: { en: 'Your turn', zh: '轮到你' },
  sReact: { en: 'They react', zh: '顾问回应' },
  sWrap: { en: 'Wrap-up plan', zh: '收尾计划' },
  r1: { en: 'Round 1 — The table debates', zh: '第一轮 — 圆桌辩论' },
  r2: { en: 'Round 2 — Your turn at the table', zh: '第二轮 — 轮到你发言' },
  r3: { en: 'Round 3 — The table reacts to you', zh: '第三轮 — 圆桌回应你' },
  rSelf: { en: 'The table debates among itself', zh: '圆桌内部辩论' },
  rWrap: { en: 'Wrap-up — your execution plan', zh: '收尾 — 你的执行计划' },
  stGrounding: { en: 'Gathering current sources…', zh: '正在收集最新资料…' },
  stInitial: { en: '{n} is speaking…', zh: '{n} 正在发言…' },
  stAligning: { en: "Aligning the table's view…", zh: '正在统一圆桌观点…' },
  stTactics: { en: '{n} is drawing up tactics…', zh: '{n} 正在制定具体做法…' },
  reading: { en: 'Reading your brief…', zh: '正在阅读你的简介…' },
  forming: { en: 'The table is forming its questions…', zh: '圆桌正在酝酿问题…' },
  replying: { en: 'is replying…', zh: '正在回复…' },
  planning: { en: 'Drawing up your plan…', zh: '正在拟定计划…' },
  recTag: { en: 'Shared recommendation', zh: '共同建议' },
  tacticsTag: { en: "{n}'s tactics", zh: '{n}的具体做法' },
  seeHow: { en: 'See how we got here — the original debate', zh: '查看得出结论的过程 — 原始辩论' },
  humanTitle: { en: 'Answer the table', zh: '回应圆桌' },
  humanSub: {
    en: "The three agents want to hear from you. Answer at least one question, or add a general note — you can't move on until the table hears something from you.",
    zh: '三位智能体想听你回答。至少回答一个问题，或补充一条备注——圆桌听到你的声音之前无法继续。',
  },
  generalNotes: { en: 'General notes', zh: '补充备注' },
  generalPh: { en: 'Anything else — context, constraints, pushback…', zh: '其他信息——背景、限制、反驳……' },
  sendTable: { en: 'Send to the table →', zh: '发送给圆桌 →' },
  seeAll: { en: 'See all questions', zh: '查看全部问题' },
  yourAnswer: { en: 'Your answer…', zh: '你的回答……' },
  you: { en: 'You', zh: '你' },
  yourResp: { en: 'Your response to the table', zh: '你对圆桌的回应' },
  qPrefix: { en: "({n}'s question) ", zh: '（{n}的问题）' },
  generalPrefix: { en: 'General notes: ', zh: '补充备注：' },
  whatNext: { en: 'What next?', zh: '接下来？' },
  optAgain: { en: 'Answer again →', zh: '再次回应 →' },
  optAgainD: { en: 'Respond to the table once more and let them challenge your new answers.', zh: '再次回应圆桌，让他们检验你的新回答。' },
  optDebate: { en: 'Let them debate →', zh: '让他们辩论 →' },
  optDebateD: { en: 'The table runs another full round on its own, without new input from you.', zh: '圆桌在没有你新输入的情况下再进行一整轮讨论。' },
  optWrap: { en: 'Wrap up → execution plan', zh: '收尾 → 执行计划' },
  optWrapD: { en: 'End the session: one concrete plan of next steps drawn from the whole discussion.', zh: '结束会话：从整场讨论中提炼出一份具体的下一步计划。' },
  planTag: { en: 'Wrap-up · execution plan', zh: '收尾 · 执行计划' },
  planRisk: { en: 'Biggest risk:', zh: '最大风险：' },
  planValidate: { en: 'Validate first:', zh: '优先验证：' },
  copyPlan: { en: '⧉ Copy plan', zh: '⧉ 复制计划' },
  copy: { en: '⧉ Copy', zh: '⧉ 复制' },
  copied: { en: '✓ Copied', zh: '✓ 已复制' },
  copyFail: { en: 'Copy failed', zh: '复制失败' },
  downloadPdf: { en: '⬇ Download PDF report', zh: '⬇ 下载 PDF 报告' },
  generatingPdf: { en: 'Generating PDF…', zh: '正在生成 PDF…' },
  reply: { en: '↩ Reply', zh: '↩ 回复' },
  replyTitle: { en: 'Talk to {n} directly — the rest of the table will remember it', zh: '直接与{n}对话——其余顾问也会记住这段交流' },
  threadPh: { en: 'Say it straight to {n} — correct a misread, push back, dig deeper…', zh: '直接对{n}说——纠正误读、提出反驳、继续深挖……' },
  send: { en: 'Send', zh: '发送' },
  clarTitle: { en: 'One moment — the table needs a little more', zh: '稍等——圆桌还需要一点信息' },
  clarSub: { en: 'Your brief left a few things open. Answer what you can, or skip — sharper input means a sharper debate.', zh: '你的简介还有几处不明。能答就答，也可跳过——输入越清晰，辩论越锋利。' },
  clarGo: { en: 'Add answers & seat the table →', zh: '补充回答并入席 →' },
  clarSkip: { en: 'Skip — run as is', zh: '跳过——按原样进行' },
  errIdea: { en: 'Describe your idea first.', zh: '请先描述你的想法。' },
  errFile: { en: 'File too large — keep it under 10 MB.', zh: '文件过大——请控制在 10 MB 以内。' },
  errDoc: { en: "Old .doc files aren't supported — please save as .docx or PDF.", zh: '不支持旧版 .doc 文件——请另存为 .docx 或 PDF。' },
  errLib: { en: 'Attachment reader could not load — check your connection, or paste the text instead.', zh: '附件读取组件加载失败——请检查网络，或直接粘贴文本。' },
  errParse: { en: "Couldn't read that file — try .txt, .md, .pdf or .docx.", zh: '无法读取该文件——请尝试 .txt、.md、.pdf 或 .docx。' },
  errEmpty: { en: 'No extractable text found in this file.', zh: '未在该文件中找到可提取的文本。' },
  planFail: { en: 'Plan failed: ', zh: '计划生成失败：' },
  rateTitle: { en: "You've reached this session's limit", zh: '本次会话已达上限' },
  rateText: { en: 'This session has used all 15 messages. Upgrade to keep going.', zh: '本次会话已用完全部 15 条消息。升级后可继续。' },
  upgrade: { en: 'Upgrade (coming soon)', zh: '升级（即将上线）' },
  signIn: { en: 'Sign in', zh: '登录' },
  signUp: { en: 'Create account', zh: '注册' },
  email: { en: 'Email', zh: '邮箱' },
  password: { en: 'Password', zh: '密码' },
  noAccount: { en: "Don't have an account?", zh: '还没有账号？' },
  haveAccount: { en: 'Already have an account?', zh: '已有账号？' },
  signOut: { en: 'Sign out', zh: '退出登录' },
  newSession: { en: '+ New', zh: '+ 新建' },
  yourSessions: { en: 'Your sessions', zh: '你的会话' },
  totalFailure: { en: "The table couldn't reach a recommendation this time — no message was used. Try again?", zh: '本次圆桌未能得出建议——未消耗一条消息额度。要重试吗？' },
  stepFailed: { en: "{n}'s response failed to load — retry?", zh: '{n}的回应加载失败——重试？' },
  retry: { en: 'Retry', zh: '重试' },
} as const;

export type StrKey = keyof typeof STR;

export function t(lang: Lang, key: StrKey, params?: Record<string, string | number>) {
  let s: string = STR[key][lang] ?? STR[key].en;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(`{${k}}`, String(params[k]));
    }
  }
  return s;
}

export const ZH_INSTRUCTION = `\n\n[CRITICAL LANGUAGE RULE — HIGHEST PRIORITY] You MUST write EVERY sentence, phrase and word of your response in Simplified Chinese (简体中文). This rule overrides everything else, INCLUDING the language of any attached document, notes, or the founder's input — even if the attached material is in English, Korean, or any other language, your entire response MUST still be in Simplified Chinese. Never respond in Korean, English, or any language other than Simplified Chinese.

Do NOT switch to English at any point, not even for a single word or clause inside a Chinese sentence. Do NOT borrow English terms or phrases — translate every concept into Chinese.

When you refer to the other agents, use their Chinese names ONLY: 市场 (Market), 构建者 (Builder), 投资人 (Investor). Never write "Market", "Builder" or "Investor" in English.

The ONLY things allowed in English are the bare structural labels at the very start of a line (e.g. SUMMARY:, RECOMMENDATION:, TACTIC:, TITLE:, STEP:, RISK:, VALIDATE:, Q:, SUFFICIENT). Write these labels EXACTLY as shown — plain, with NO markdown. Everything after each label must be Simplified Chinese.`;

export const NO_MD_INSTRUCTION = `\n\nFORMAT: Output plain text only. Do NOT use markdown — no "#" or "##" headers, no asterisks, no bold. Write each structural label bare at the start of its line with nothing before it.`;
