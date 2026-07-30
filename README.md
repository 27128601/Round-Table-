# The Round Table

## Problem statement
Founders build for months, sometimes years, before finding out nobody actually wanted what they made.By then, the time and money are already gone. Early stage founders rarely have access to a room full of experienced advisors willing to stress test an idea honestly before a single line of code gets written.

## Solution description
The Round Table is an AI powered advisory panel. A founder describes a raw idea and immediately gets challenged, questioned, and advised by five distinct expert personas, each with a mutually exclusive point of view. The founder answers clarifying questions first. Then the panel debates the idea in real time. A shared recommendation follows, shown with a confidence score. The founder can push back or ask follow up questions to any individual advisor. At the end, they walk away with a concrete execution plan they can export and share with co founders. It is built to catch the fatal flaw in an idea before it costs the founder months of wasted building.

## AI approach and architecture
Five independent AI agents run in parallel, each locked into a distinct role: Visionary, Builder, Market, Operator, and Storyteller. Each agent receives the same idea, but operates under its own separate system prompt. As a result, the idea gets challenged from different angles, and no two takes overlap. Advice is grounded with live web search results, so claims are backed by real sources rather than invented statistics. A separate synthesis call then reads that debate and produces one shared recommendation. It explicitly resolves where the advisors disagreed, instead of averaging their views into something generic. Once the recommendation is set, all five roles generate their own tactics from it, telling the user their immediate next steps. The entire process streams live to the screen as each piece completes, so the founder can watch the analysis unfold in real time rather than wait on a single delayed response.

## Selected challenge theme
IBM Wildcard Challenge.

## How IBM Bob was used
IBM Bob was one of the two pillars in the entire product. Claude handled the basic execution, but Bob was the thinking partner behind the decisions that actually shaped the product into what it became.

The panel did not start as five advisors, it started as three, and it was working through the tradeoffs with Bob that surfaced the core problem with a three advisor structure: three voices telling a founder whether an idea is good is not enough, a founder also needs to be told what to do about it. That distinction, judgment roles versus action roles, is what led directly to splitting the panel into five, adding Operator and Storyteller as the two agents responsible for execution and go to market rather than verdict.

Bob was equally central to the interface. The bell curve confidence gauge exists because Bob helped us work out how to turn five conflicting opinions into one visual signal a founder could read at a glance, instead of five walls of text they would have to piece together themselves.

In short, Bob is why this product works the way it does.
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
