import React from "react";

import { LessonMarkdown } from "./LessonMarkdown";

import { DiagramPedagogyReveal } from "./DiagramPedagogyReveal";

import type { DiagramRevealDisplay } from "../../utils/diagramPedagogyDisplay";

import "./diagramBlockPedagogy.css";



export type DiagramBlockPedagogyProps = {

  title?: string | null;

  /** Teacher explanation / what to look for (subtitle field). */

  instructions?: string | null;

  /** Student questions or activities (studentTask field). */

  studentTask?: string | null;

  /** @deprecated Use instructions — legacy alias */

  subtitle?: string | null;

  caption?: string | null;

  reveal?: DiagramRevealDisplay | null;

  children: React.ReactNode;

  className?: string;

};



function stripLeadingTaskHeading(text: string): string {

  return text.replace(/^\s*task\s*:?\s*/i, "").trim();

}



/**

 * Student-facing diagram chrome: title → figure → instructions → student task → reveal → caption.

 */

export function DiagramBlockPedagogy({

  title,

  instructions,

  studentTask,

  subtitle,

  caption,

  reveal,

  children,

  className,

}: DiagramBlockPedagogyProps): React.ReactElement {

  const titleTrim = typeof title === "string" ? title.trim() : "";

  const instructionsTrim =

    (typeof instructions === "string" ? instructions.trim() : "") ||

    (typeof subtitle === "string" && !studentTask?.trim() ? subtitle.trim() : "");

  const studentTaskTrim = typeof studentTask === "string" ? studentTask.trim() : "";

  const studentTaskBody = studentTaskTrim ? stripLeadingTaskHeading(studentTaskTrim) : "";

  const captionTrim = typeof caption === "string" ? caption.trim() : "";



  return (

    <div className={["lr-diagram-pedagogy", className].filter(Boolean).join(" ")}>

      {titleTrim ? <h3 className="lr-diagram-pedagogy__title">{titleTrim}</h3> : null}

      <div className="lr-diagram-pedagogy__media">{children}</div>

      {instructionsTrim ? (

        <div

          className="lr-diagram-pedagogy__instructions lesson-rich-text"

          data-testid="diagram-instructions"

        >

          <div className="lr-diagram-pedagogy__instructions-heading">Instructions</div>

          <LessonMarkdown className="lesson-md-body">{instructionsTrim}</LessonMarkdown>

        </div>

      ) : null}

      {studentTaskTrim ? (

        <div

          className="lr-diagram-pedagogy__student-task lesson-rich-text"

          data-testid="diagram-student-task"

        >

          <div className="lr-diagram-pedagogy__student-task-heading">Task</div>

          <LessonMarkdown className="lesson-md-body">

            {studentTaskBody || studentTaskTrim}

          </LessonMarkdown>

        </div>

      ) : null}

      {reveal?.body?.trim() ? <DiagramPedagogyReveal reveal={reveal} /> : null}

      {captionTrim ? (

        <div className="lr-diagram-pedagogy__caption lesson-rich-text">

          <LessonMarkdown className="lesson-md-body lesson-md-body--caption">{captionTrim}</LessonMarkdown>

        </div>

      ) : null}

    </div>

  );

}


