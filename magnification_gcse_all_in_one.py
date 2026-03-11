from manim import *

# Save as: magnification_gcse_all_in_one.py
# Run with:
#   pip install manim
#   manim -pqh magnification_gcse_all_in_one.py MagnificationGCSEAllInOne


class MagnificationGCSEAllInOne(Scene):
    def construct(self):
        self.camera.background_color = "#f5f5f5"

        # -------------------------------------------------
        # Scene 1: Intro - Cells and magnification
        # -------------------------------------------------
        title = Text("Cells and Magnification", color=BLACK, font_size=40)
        body = Paragraph(
            "Cells are too small to see clearly with the naked eye.",
            "Microscopes are used to magnify cell structures.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.7,
        )

        left_panel = VGroup(title, body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.2)

        microscope = self.create_microscope().scale(1.2).to_edge(RIGHT, buff=1.2)

        self.play(FadeIn(title, shift=UP * 0.2))
        self.play(FadeIn(body, shift=UP * 0.2))
        self.play(FadeIn(microscope, shift=RIGHT * 0.3))
        self.wait(1)

        # -------------------------------------------------
        # Scene 2: Formula introduction
        # -------------------------------------------------
        calc_title = Text("Calculating Magnification", color=BLACK, font_size=40)
        calc_body = Paragraph(
            "Magnification can be calculated by dividing",
            "the image size by the actual size of a structure.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.7,
        )

        calc_left = VGroup(calc_title, calc_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.2)

        formula_banner = self.formula_box(
            "MAGNIFICATION = IMAGE SIZE ÷ ACTUAL SIZE",
            fill="#dff2a4",
            w=4.9,
            h=0.45,
            font_size=20,
        ).move_to(UP * 2.2 + RIGHT * 1.8)

        self.play(
            FadeOut(left_panel),
            FadeOut(microscope),
            FadeIn(calc_left, shift=UP * 0.2),
        )
        self.play(FadeIn(formula_banner, shift=UP * 0.2))
        self.wait(0.6)

        # -------------------------------------------------
        # Scene 3: IAM triangle
        # -------------------------------------------------
        triangle_group, i_text, a_text, m_text = self.create_iam_triangle()
        triangle_group.move_to(RIGHT * 1.9 + DOWN * 0.7)
        i_text.move_to(triangle_group.get_center() + UP * 0.7)
        a_text.move_to(triangle_group.get_center() + LEFT * 0.58 + DOWN * 0.58)
        m_text.move_to(triangle_group.get_center() + RIGHT * 0.58 + DOWN * 0.58)

        self.play(FadeIn(triangle_group, shift=UP * 0.2))
        self.play(FadeIn(i_text, shift=UP * 0.25))
        self.play(FadeIn(a_text, shift=LEFT * 0.25))
        self.play(FadeIn(m_text, shift=RIGHT * 0.25))

        key = VGroup(
            Text("I = image size", color=BLACK, font_size=20),
            Text("A = actual size", color=BLACK, font_size=20),
            Text("M = magnification", color=BLACK, font_size=20),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
        key.to_edge(LEFT, buff=0.8).shift(DOWN * 1.3)

        self.play(FadeIn(key, shift=RIGHT * 0.2))
        self.wait(1)

        # -------------------------------------------------
        # Scene 4: Rearranged formulas
        # -------------------------------------------------
        box1 = self.formula_box(
            "MAGNIFICATION = IMAGE SIZE ÷ ACTUAL SIZE",
            fill="#f5d4d4",
            w=5.0,
            h=0.42,
            font_size=18,
        )
        box2 = self.formula_box(
            "ACTUAL SIZE = IMAGE SIZE ÷ MAGNIFICATION",
            fill="#d7f2d7",
            w=5.2,
            h=0.42,
            font_size=18,
        )
        box3 = self.formula_box(
            "IMAGE SIZE = ACTUAL SIZE × MAGNIFICATION",
            fill="#d6ebff",
            w=5.1,
            h=0.42,
            font_size=18,
        )

        formulas = VGroup(box1, box2, box3).arrange(
            DOWN, aligned_edge=LEFT, buff=0.15
        )
        formulas.next_to(triangle_group, DOWN, buff=0.45)

        self.play(FadeIn(box1, shift=UP * 0.15))
        self.play(FadeIn(box2, shift=UP * 0.15))
        self.play(FadeIn(box3, shift=UP * 0.15))
        self.wait(1)

        # -------------------------------------------------
        # Scene 5: Worked example with ruler and plant cell
        # -------------------------------------------------
        example_title = Text("Worked Example", color=BLACK, font_size=38)
        example_body = Paragraph(
            "A plant cell image measures 30 mm.",
            "The actual size of the cell is 0.01 mm.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.7,
        )

        example_left = VGroup(example_title, example_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        self.play(
            FadeOut(calc_left),
            FadeOut(key),
            FadeOut(formulas),
            FadeOut(formula_banner),
            triangle_group.animate.scale(0.78).to_edge(LEFT, buff=1.0).shift(UP * 0.2),
            i_text.animate.scale(0.78).move_to(LEFT * 4.2 + UP * 0.25),
            a_text.animate.scale(0.78).move_to(LEFT * 4.62 + DOWN * 0.28),
            m_text.animate.scale(0.78).move_to(LEFT * 3.88 + DOWN * 0.28),
            FadeIn(example_left, shift=UP * 0.2),
        )

        plant_cell = self.create_plant_cell().scale(1.0).move_to(RIGHT * 3.5 + UP * 0.4)
        ruler = self.create_ruler(width=3.0).next_to(plant_cell, DOWN, buff=0.15)
        actual_width_arrow = DoubleArrow(
            plant_cell.get_left() + UP * 1.0,
            plant_cell.get_right() + UP * 1.0,
            color=BLACK,
            buff=0,
            stroke_width=2,
        )
        actual_width_label = Text("0.01 mm", color=BLACK, font_size=20).next_to(
            actual_width_arrow, UP, buff=0.08
        )
        image_size_label = Text("30 mm", color=BLACK, font_size=20).next_to(
            ruler, DOWN, buff=0.1
        )

        self.play(FadeIn(plant_cell, shift=RIGHT * 0.2))
        self.play(GrowArrow(actual_width_arrow), FadeIn(actual_width_label))
        self.play(FadeIn(ruler, shift=UP * 0.1), FadeIn(image_size_label, shift=UP * 0.1))

        calc1 = Text("Magnification = image size ÷ actual size", color=BLACK, font_size=24)
        calc2 = Text("Magnification = 30 ÷ 0.01", color=BLACK, font_size=24)
        calc3 = Text("Magnification = 3000", color=BLACK, font_size=28)
        answer_box = self.formula_box("Magnification = ×3000", fill="#dff2a4", w=3.4, h=0.5, font_size=22)

        calc_group = VGroup(calc1, calc2, calc3, answer_box).arrange(
            DOWN, aligned_edge=LEFT, buff=0.22
        ).to_edge(LEFT, buff=0.8).shift(DOWN * 2.0)

        self.play(Write(calc1))
        self.play(Write(calc2))
        self.play(FadeIn(calc3, shift=UP * 0.15))
        self.play(FadeIn(answer_box, shift=UP * 0.15))
        self.wait(1.2)

        # -------------------------------------------------
        # Scene 6: Unit conversion example
        # -------------------------------------------------
        unit_title = Text("Unit Conversion Example", color=BLACK, font_size=38)
        unit_body = Paragraph(
            "A drawing measures 50 mm.",
            "The actual size is 2000 µm.",
            "Convert 2000 µm into 2 mm first.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.7,
        )
        unit_left = VGroup(unit_title, unit_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 0.9)

        self.play(
            FadeOut(example_left),
            FadeOut(plant_cell),
            FadeOut(ruler),
            FadeOut(actual_width_arrow),
            FadeOut(actual_width_label),
            FadeOut(image_size_label),
            FadeOut(calc_group),
            FadeIn(unit_left, shift=UP * 0.2),
        )

        unit_calc1 = Text("Magnification = image size ÷ actual size", color=BLACK, font_size=24)
        unit_calc2 = Text("Magnification = 50 ÷ 2", color=BLACK, font_size=24)
        unit_calc3 = Text("Magnification = 25", color=BLACK, font_size=28)
        unit_answer = self.formula_box("Magnification = ×25", fill="#dff2a4", w=3.0, h=0.5, font_size=22)

        unit_group = VGroup(unit_calc1, unit_calc2, unit_calc3, unit_answer).arrange(
            DOWN, aligned_edge=LEFT, buff=0.22
        ).move_to(RIGHT * 2.8 + DOWN * 0.3)

        self.play(Write(unit_calc1))
        self.play(Write(unit_calc2))
        self.play(FadeIn(unit_calc3, shift=UP * 0.15))
        self.play(FadeIn(unit_answer, shift=UP * 0.15))
        self.wait(1.2)

        # -------------------------------------------------
        # Scene 7: Exam-style question
        # -------------------------------------------------
        exam_title = Text("Exam-Style Question", color=BLACK, font_size=38)
        exam_body = Paragraph(
            "A cell image measures 24 mm.",
            "The magnification is ×600.",
            "Calculate the actual size of the cell.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.7,
        )
        exam_left = VGroup(exam_title, exam_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 0.9)

        self.play(
            FadeOut(unit_left),
            FadeOut(unit_group),
            FadeIn(exam_left, shift=UP * 0.2),
        )

        exam_calc1 = Text("Actual size = image size ÷ magnification", color=BLACK, font_size=24)
        exam_calc2 = Text("Actual size = 24 ÷ 600", color=BLACK, font_size=24)
        exam_calc3 = Text("Actual size = 0.04 mm", color=BLACK, font_size=28)
        exam_calc4 = Text("0.04 mm = 40 µm", color=BLACK, font_size=24)
        exam_answer = self.formula_box("Answer: 0.04 mm or 40 µm", fill="#d6ebff", w=4.2, h=0.5, font_size=20)

        exam_group = VGroup(
            exam_calc1, exam_calc2, exam_calc3, exam_calc4, exam_answer
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.22).move_to(RIGHT * 2.7 + DOWN * 0.2)

        self.play(Write(exam_calc1))
        self.play(Write(exam_calc2))
        self.play(FadeIn(exam_calc3, shift=UP * 0.15))
        self.play(FadeIn(exam_calc4, shift=UP * 0.15))
        self.play(FadeIn(exam_answer, shift=UP * 0.15))
        self.wait(1.5)

        # -------------------------------------------------
        # Scene 8: Final recap
        # -------------------------------------------------
        recap_title = Text("Exam Tips", color=BLACK, font_size=38)
        tips = BulletedList(
            "Write the formula first",
            "Make sure the units match",
            "Show each calculation step",
            "Give magnification as × number",
            color=BLACK,
            font_size=22,
        ).scale(0.95)

        iam_tip = self.formula_box("Triangle reminder: I A M", fill="#fff0a8", w=3.2, h=0.5, font_size=22)

        recap_group = VGroup(recap_title, tips, iam_tip).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).move_to(ORIGIN)

        self.play(
            FadeOut(exam_left),
            FadeOut(exam_group),
            FadeOut(triangle_group),
            FadeOut(i_text),
            FadeOut(a_text),
            FadeOut(m_text),
        )
        self.play(FadeIn(recap_group, shift=UP * 0.2))
        self.wait(2)

    # -------------------------------------------------
    # Helper builders
    # -------------------------------------------------

    def formula_box(self, text, fill, w=4.8, h=0.48, font_size=20):
        rect = RoundedRectangle(
            corner_radius=0.08,
            width=w,
            height=h,
            color=GRAY_D,
            fill_color=fill,
            fill_opacity=1,
            stroke_width=1.5,
        )
        label = Text(text, color=BLACK, font_size=font_size).move_to(rect.get_center())
        return VGroup(rect, label)

    def create_iam_triangle(self):
        tri = Polygon(
            [-1.8, -2.2, 0],
            [0, 0.9, 0],
            [1.8, -2.2, 0],
            color=GRAY_D,
            fill_color="#5da5ff",
            fill_opacity=1,
            stroke_width=2,
        )

        horizontal = Line(
            [-1.05, -0.85, 0],
            [1.05, -0.85, 0],
            color="#ff5ca8",
            stroke_width=3,
        )

        vertical = Line(
            [0, -0.85, 0],
            [0, -2.2, 0],
            color="#ff5ca8",
            stroke_width=3,
        )

        i_text = Text("I", color=BLACK, font_size=36)
        a_text = Text("A", color=BLACK, font_size=36)
        m_text = Text("M", color=BLACK, font_size=36)

        return VGroup(tri, horizontal, vertical), i_text, a_text, m_text

    def create_ruler(self, width=3.0):
        base = Rectangle(
            width=width,
            height=0.35,
            color=GRAY_D,
            fill_color="#f2f2f2",
            fill_opacity=1,
            stroke_width=1.5,
        )

        ticks = VGroup()
        for i in range(11):
            x = -width / 2 + i * (width / 10)
            tick_h = 0.18 if i % 5 == 0 else 0.12
            tick = Line(
                [x, base.get_top()[1], 0],
                [x, base.get_top()[1] - tick_h, 0],
                color=BLACK,
                stroke_width=1.5,
            )
            ticks.add(tick)

            if i < 10:
                num = Text(str(i), color=BLACK, font_size=12)
                num.next_to(base, DOWN, buff=0.02)
                num.shift(RIGHT * (x + width / 20))
                ticks.add(num)

        return VGroup(base, ticks)

    def create_plant_cell(self):
        outer = RoundedRectangle(
            width=2.7,
            height=2.0,
            corner_radius=0.2,
            color=BLUE_D,
            fill_color="#69d2ff",
            fill_opacity=1,
            stroke_width=2,
        )

        membrane = RoundedRectangle(
            width=2.45,
            height=1.75,
            corner_radius=0.16,
            color="#1e88c8",
            fill_opacity=0,
            stroke_width=1.5,
        )

        nucleus = Circle(
            radius=0.28,
            color=RED_D,
            fill_color="#ff7c8b",
            fill_opacity=1,
            stroke_width=1.5,
        ).shift(RIGHT * 0.65 + UP * 0.35)

        vacuole = VMobject()
        vacuole.set_points_as_corners([
            [-0.35, 0.15, 0],
            [-0.10, 0.35, 0],
            [0.20, 0.25, 0],
            [0.30, 0.00, 0],
            [0.15, -0.25, 0],
            [-0.15, -0.30, 0],
            [-0.35, -0.05, 0],
            [-0.35, 0.15, 0],
        ])
        vacuole.set_fill("#3dd7aa", opacity=1)
        vacuole.set_stroke("#1aa37d", width=1.5)

        chl1 = Ellipse(
            width=0.32, height=0.16,
            color=GREEN_D, fill_color="#8fd96a", fill_opacity=1
        ).shift(LEFT * 0.62 + UP * 0.4)
        chl2 = Ellipse(
            width=0.32, height=0.16,
            color=GREEN_D, fill_color="#8fd96a", fill_opacity=1
        ).shift(LEFT * 0.45 + DOWN * 0.35)
        chl3 = Ellipse(
            width=0.30, height=0.15,
            color=GREEN_D, fill_color="#8fd96a", fill_opacity=1
        ).shift(UP * 0.55)

        mito1 = Ellipse(
            width=0.26, height=0.12,
            color="#8b5a2b", fill_color="#d69b5e", fill_opacity=1
        ).shift(RIGHT * 0.72 + DOWN * 0.28)
        mito2 = Ellipse(
            width=0.22, height=0.10,
            color="#8b5a2b", fill_color="#d69b5e", fill_opacity=1
        ).shift(LEFT * 0.75 + UP * 0.02)

        return VGroup(outer, membrane, nucleus, vacuole, chl1, chl2, chl3, mito1, mito2)

    def create_microscope(self):
        base = Rectangle(
            width=1.8, height=0.28,
            color=GRAY_D, fill_color=GRAY_C, fill_opacity=1
        )
        foot = Rectangle(
            width=0.3, height=0.12,
            color=GRAY_E, fill_color=GRAY_E, fill_opacity=1
        ).next_to(base, DOWN, buff=0)
        foot.align_to(base, LEFT).shift(RIGHT * 0.25)

        pillar = Rectangle(
            width=0.35, height=1.2,
            color=GRAY_D, fill_color=GRAY_B, fill_opacity=1
        ).move_to(base.get_center() + LEFT * 0.3 + UP * 0.75)

        arm = ArcBetweenPoints(
            pillar.get_top() + LEFT * 0.05,
            base.get_left() + UP * 0.3,
            angle=PI / 2.2,
            color=GRAY_D,
            stroke_width=16,
        )

        head = Rectangle(
            width=0.45, height=1.0,
            color=GRAY_D, fill_color=GRAY_B, fill_opacity=1
        ).next_to(pillar, UP, buff=0.1).shift(RIGHT * 0.18)

        eyepiece = Rectangle(
            width=0.22, height=0.32,
            color=GRAY_D, fill_color=GRAY_C, fill_opacity=1
        ).next_to(head, UP, buff=0)

        stage = Rectangle(
            width=0.85, height=0.12,
            color=GRAY_D, fill_color=GRAY_C, fill_opacity=1
        ).move_to(pillar.get_center() + RIGHT * 0.55 + DOWN * 0.15)

        lens = Line(
            stage.get_top() + RIGHT * 0.15 + UP * 0.35,
            stage.get_top() + RIGHT * 0.38,
            color=GRAY_E,
            stroke_width=6,
        )

        knob1 = Circle(radius=0.12, color=GRAY_E, fill_color=GRAY_E, fill_opacity=1).move_to(
            pillar.get_center() + LEFT * 0.35 + UP * 0.25
        )
        knob2 = Circle(radius=0.07, color=GRAY_E, fill_color=GRAY_E, fill_opacity=1).move_to(
            pillar.get_center() + LEFT * 0.35 + DOWN * 0.15
        )

        return VGroup(base, foot, pillar, arm, head, eyepiece, stage, lens, knob1, knob2)
