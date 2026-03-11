from pathlib import Path

from manim import *

# Images are loaded from:
#   backend/public/visuals/biology/aqa-gcse/cell-biology/cell-structure/
# Required files: microscope.png, ruler.png, plant_cell.png,
#                 red_blood_cell.png, cheek_cell.png
#
# Run with:
#   pip install manim
#   manim -pqh magnification_gcse_external_images.py MagnificationGCSEExternalImages
#
# Then copy the video to the visuals folder for Microscopy lessons:
#   node scripts/copy-magnification-video.js

IMAGE_DIR = (
    Path(__file__).resolve().parent
    / "backend"
    / "public"
    / "visuals"
    / "biology"
    / "aqa-gcse"
    / "cell-biology"
    / "cell-structure"
)


class MagnificationGCSEExternalImages(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#f7f7f7"

        # Camera zoom helper: zoom into target, then restore
        def zoom_to(mob, scale=0.4, run=1.5):
            self.camera.frame.save_state()
            self.play(
                self.camera.frame.animate.scale(scale).move_to(mob),
                run_time=run,
                rate_func=smooth,
            )

        def zoom_restore(run=1.2):
            self.play(Restore(self.camera.frame), run_time=run, rate_func=smooth)

        # ----------------------------
        # Scene 1: Intro
        # ----------------------------
        title = Text("Cells and Magnification", color=BLACK, font_size=40)
        body = Paragraph(
            "Cells are too small to see clearly with the naked eye.",
            "Microscopes are used to magnify cell structures.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.8,
        )

        intro_left = VGroup(title, body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        microscope = ImageMobject(str(IMAGE_DIR / "microscope.png")).scale(0.9).to_edge(RIGHT, buff=1.1)

        self.play(FadeIn(title, shift=UP * 0.2), run_time=1.5)
        self.play(FadeIn(body, shift=UP * 0.2), run_time=2)
        self.play(FadeIn(microscope, shift=RIGHT * 0.3), run_time=2)
        self.wait(2)

        # ----------------------------
        # Scene 2: Formula
        # ----------------------------
        calc_title = Text("Calculating Magnification", color=BLACK, font_size=40)
        calc_body = Paragraph(
            "Magnification can be calculated by dividing",
            "the image size by the actual size of a structure.",
            alignment="left",
            color=BLACK,
            font_size=22,
            line_spacing=0.8,
        )

        calc_left = VGroup(calc_title, calc_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        formula_banner = self.formula_box(
            "MAGNIFICATION = IMAGE SIZE ÷ ACTUAL SIZE",
            fill="#fff2a8",
            w=5.1,
            h=0.55,
            font_size=22,
        ).move_to(UP * 2.1 + RIGHT * 1.8)

        self.play(
            FadeOut(intro_left),
            FadeOut(microscope),
            FadeIn(calc_left, shift=UP * 0.2),
            run_time=2,
        )
        self.play(FadeIn(formula_banner, shift=UP * 0.2), run_time=1.8)
        self.wait(1)

        # Smooth zoom into formula + step-by-step highlighting
        zoom_to(formula_banner, scale=0.5, run=1.2)
        self.wait(0.5)
        # Highlight each part of the equation in sequence
        fb_center = formula_banner.get_center()
        fb_left = formula_banner.get_left()
        fb_width = formula_banner.width
        highlight_opts = {"fill_color": YELLOW, "fill_opacity": 0.35, "stroke_width": 0}
        h1 = RoundedRectangle(width=1.8, height=0.5, corner_radius=0.05, **highlight_opts).move_to(fb_center + LEFT * 1.65)
        h2 = RoundedRectangle(width=1.6, height=0.5, corner_radius=0.05, **highlight_opts).move_to(fb_center)
        h3 = RoundedRectangle(width=1.4, height=0.5, corner_radius=0.05, **highlight_opts).move_to(fb_center + RIGHT * 1.6)
        for h in [h1, h2, h3]:
            h.set_z_index(-0.5)
        self.play(FadeIn(h1), run_time=0.8)
        self.wait(0.6)
        self.play(ReplacementTransform(h1, h2), run_time=0.8)
        self.wait(0.6)
        self.play(ReplacementTransform(h2, h3), run_time=0.8)
        self.wait(0.6)
        self.play(FadeOut(h3), run_time=0.5)
        zoom_restore(run=1.0)
        self.wait(0.5)

        # ----------------------------
        # Scene 3: IAM triangle
        # ----------------------------
        triangle_group, i_text, a_text, m_text = self.create_iam_triangle()
        triangle_group.move_to(RIGHT * 1.9 + DOWN * 0.5)
        i_text.move_to(triangle_group.get_center() + UP * 0.72)
        a_text.move_to(triangle_group.get_center() + LEFT * 0.58 + DOWN * 0.58)
        m_text.move_to(triangle_group.get_center() + RIGHT * 0.58 + DOWN * 0.58)

        self.play(FadeIn(triangle_group, shift=UP * 0.2), run_time=1.8)
        self.wait(0.6)
        self.play(FadeIn(i_text, shift=UP * 0.3), run_time=1.3)
        self.wait(0.5)
        self.play(FadeIn(a_text, shift=LEFT * 0.3), run_time=1.3)
        self.wait(0.5)
        self.play(FadeIn(m_text, shift=RIGHT * 0.3), run_time=1.3)
        self.wait(1.5)

        key = VGroup(
            Text("I = image size", color=BLACK, font_size=20),
            Text("A = actual size", color=BLACK, font_size=20),
            Text("M = magnification", color=BLACK, font_size=20),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
        key.to_edge(LEFT, buff=0.8).shift(DOWN * 1.2)

        self.play(FadeIn(key, shift=RIGHT * 0.2), run_time=1.5)
        self.wait(1)

        # Hand covering triangle (teacher style) - cover M to show I ÷ A
        hand = self.create_teacher_hand()
        hand.scale(0.85).move_to(triangle_group.get_center() + DOWN * 0.1)
        hand.set_z_index(10)
        self.play(FadeIn(hand, scale=1.1), run_time=1.2)
        self.wait(1.5)
        self.play(FadeOut(hand), run_time=1)

        self.wait(0.5)

        # ----------------------------
        # Scene 4: Rearranged formulas
        # ----------------------------
        box1 = self.formula_box(
            "MAGNIFICATION = IMAGE SIZE ÷ ACTUAL SIZE",
            fill="#ffd8d8", w=5.2, h=0.45, font_size=18
        )
        box2 = self.formula_box(
            "ACTUAL SIZE = IMAGE SIZE ÷ MAGNIFICATION",
            fill="#d8f2d8", w=5.35, h=0.45, font_size=18
        )
        box3 = self.formula_box(
            "IMAGE SIZE = ACTUAL SIZE × MAGNIFICATION",
            fill="#d7e9ff", w=5.25, h=0.45, font_size=18
        )

        formula_list = VGroup(box1, box2, box3).arrange(
            DOWN, aligned_edge=LEFT, buff=0.16
        )
        formula_list.next_to(triangle_group, DOWN, buff=0.45)

        self.play(FadeIn(box1, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(box2, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(box3, shift=UP * 0.15), run_time=1.5)
        self.wait(2)

        # ----------------------------
        # Scene 5: Worked example 1 - Plant cell
        # ----------------------------
        example1_title = Text("Example 1: Plant Cell", color=BLACK, font_size=38)
        example1_body = Paragraph(
            "Image size = 30 mm",
            "Actual size = 0.01 mm",
            alignment="left",
            color=BLACK,
            font_size=24,
            line_spacing=0.8,
        )

        example1_left = VGroup(example1_title, example1_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        self.play(
            FadeOut(calc_left),
            FadeOut(formula_banner),
            FadeOut(key),
            FadeOut(formula_list),
            triangle_group.animate.scale(0.78).to_edge(LEFT, buff=1.0).shift(UP * 0.2),
            i_text.animate.scale(0.78).move_to(LEFT * 4.2 + UP * 0.25),
            a_text.animate.scale(0.78).move_to(LEFT * 4.62 + DOWN * 0.28),
            m_text.animate.scale(0.78).move_to(LEFT * 3.88 + DOWN * 0.28),
            FadeIn(example1_left, shift=UP * 0.2),
            run_time=2.5,
        )

        plant_cell = ImageMobject(str(IMAGE_DIR / "plant_cell.png")).scale(0.75).move_to(RIGHT * 3.5 + UP * 0.45)
        ruler = ImageMobject(str(IMAGE_DIR / "ruler.png")).scale(0.75).next_to(plant_cell, DOWN, buff=0.2)
        ruler_target_pos = ruler.get_center()
        ruler.shift(DOWN * 1.5)  # start below for slide-up measuring motion

        actual_arrow = DoubleArrow(
            plant_cell.get_left() + UP * 1.05,
            plant_cell.get_right() + UP * 1.05,
            color=BLACK,
            buff=0,
            stroke_width=2,
        )
        actual_label = Text("0.01 mm", color=BLACK, font_size=20).next_to(actual_arrow, UP, buff=0.08)
        image_label = Text("30 mm", color=BLACK, font_size=20).next_to(ruler, DOWN, buff=0.08)

        self.play(FadeIn(plant_cell, shift=RIGHT * 0.2), run_time=2)
        self.wait(0.5)
        # Zoom into cell for measurement
        cell_ruler_group = Group(plant_cell, ruler)
        zoom_to(cell_ruler_group, scale=0.55, run=1.2)
        self.play(GrowArrow(actual_arrow), FadeIn(actual_label), run_time=1.8)
        self.wait(0.3)
        # Ruler slides up into place (measuring motion)
        self.add(ruler)
        self.play(
            ruler.animate.move_to(ruler_target_pos),
            run_time=1.5,
            rate_func=smooth,
        )
        self.play(FadeIn(image_label), run_time=0.8)
        zoom_restore(run=1.0)
        self.wait(1)

        calc1 = Text("Magnification = image size ÷ actual size", color=BLACK, font_size=24)
        calc2 = Text("Magnification = 30 ÷ 0.01", color=BLACK, font_size=24)
        calc3 = Text("Magnification = 3000", color=BLACK, font_size=28)
        answer1 = self.formula_box("Magnification = ×3000", fill="#dff2a4", w=3.5, h=0.52, font_size=22)

        calc_group1 = VGroup(calc1, calc2, calc3, answer1).arrange(
            DOWN, aligned_edge=LEFT, buff=0.24
        ).to_edge(LEFT, buff=0.8).shift(DOWN * 2.0)

        self.play(Write(calc1), run_time=2)
        self.wait(0.7)
        self.play(Write(calc2), run_time=1.8)
        self.wait(0.7)
        self.play(FadeIn(calc3, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(answer1, shift=UP * 0.15), run_time=1.5)
        self.wait(2.5)

        # ----------------------------
        # Scene 6: Worked example 2 - Red blood cell
        # ----------------------------
        example2_title = Text("Example 2: Red Blood Cell", color=BLACK, font_size=38)
        example2_body = Paragraph(
            "Image size = 15 mm",
            "Actual size = 0.0075 mm",
            alignment="left",
            color=BLACK,
            font_size=24,
            line_spacing=0.8,
        )

        example2_left = VGroup(example2_title, example2_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        self.play(
            FadeOut(example1_left),
            FadeOut(plant_cell),
            FadeOut(ruler),
            FadeOut(actual_arrow),
            FadeOut(actual_label),
            FadeOut(image_label),
            FadeOut(calc_group1),
            FadeIn(example2_left, shift=UP * 0.2),
            run_time=2.5,
        )

        rbc = ImageMobject(str(IMAGE_DIR / "red_blood_cell.png")).scale(0.7).move_to(RIGHT * 3.5 + UP * 0.45)
        ruler2 = ImageMobject(str(IMAGE_DIR / "ruler.png")).scale(0.72).next_to(rbc, DOWN, buff=0.2)
        ruler2_target = ruler2.get_center()
        ruler2.shift(DOWN * 1.2)

        actual_arrow2 = DoubleArrow(
            rbc.get_left() + UP * 0.9,
            rbc.get_right() + UP * 0.9,
            color=BLACK,
            buff=0,
            stroke_width=2,
        )
        actual_label2 = Text("0.0075 mm", color=BLACK, font_size=20).next_to(actual_arrow2, UP, buff=0.08)
        image_label2 = Text("15 mm", color=BLACK, font_size=20).next_to(ruler2, DOWN, buff=0.08)

        self.play(FadeIn(rbc, shift=RIGHT * 0.2), run_time=2)
        self.wait(0.5)
        self.play(GrowArrow(actual_arrow2), FadeIn(actual_label2), run_time=1.8)
        self.wait(0.3)
        self.add(ruler2)
        self.play(ruler2.animate.move_to(ruler2_target), run_time=1.3, rate_func=smooth)
        self.play(FadeIn(image_label2), run_time=0.6)
        self.wait(1)

        rbc_calc1 = Text("Magnification = image size ÷ actual size", color=BLACK, font_size=24)
        rbc_calc2 = Text("Magnification = 15 ÷ 0.0075", color=BLACK, font_size=24)
        rbc_calc3 = Text("Magnification = 2000", color=BLACK, font_size=28)
        rbc_answer = self.formula_box("Magnification = ×2000", fill="#dff2a4", w=3.5, h=0.52, font_size=22)

        calc_group2 = VGroup(rbc_calc1, rbc_calc2, rbc_calc3, rbc_answer).arrange(
            DOWN, aligned_edge=LEFT, buff=0.24
        ).to_edge(LEFT, buff=0.8).shift(DOWN * 2.0)

        self.play(Write(rbc_calc1), run_time=2)
        self.wait(0.7)
        self.play(Write(rbc_calc2), run_time=1.8)
        self.wait(0.7)
        self.play(FadeIn(rbc_calc3, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(rbc_answer, shift=UP * 0.15), run_time=1.5)
        self.wait(2.5)

        # ----------------------------
        # Scene 7: Worked example 3 - Cheek cell with conversion
        # ----------------------------
        example3_title = Text("Example 3: Cheek Cell", color=BLACK, font_size=38)
        example3_body = Paragraph(
            "Image size = 40 mm",
            "Actual size = 50 µm",
            "Convert 50 µm into 0.05 mm first.",
            alignment="left",
            color=BLACK,
            font_size=24,
            line_spacing=0.8,
        )

        example3_left = VGroup(example3_title, example3_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 0.9)

        self.play(
            FadeOut(example2_left),
            FadeOut(rbc),
            FadeOut(ruler2),
            FadeOut(actual_arrow2),
            FadeOut(actual_label2),
            FadeOut(image_label2),
            FadeOut(calc_group2),
            FadeIn(example3_left, shift=UP * 0.2),
            run_time=2.5,
        )

        cheek = ImageMobject(str(IMAGE_DIR / "cheek_cell.png")).scale(0.75).move_to(RIGHT * 3.5 + UP * 0.45)
        ruler3 = ImageMobject(str(IMAGE_DIR / "ruler.png")).scale(0.78).next_to(cheek, DOWN, buff=0.2)
        ruler3_target = ruler3.get_center()
        ruler3.shift(DOWN * 1.2)

        actual_arrow3 = DoubleArrow(
            cheek.get_left() + UP * 1.0,
            cheek.get_right() + UP * 1.0,
            color=BLACK,
            buff=0,
            stroke_width=2,
        )
        actual_label3 = Text("50 µm", color=BLACK, font_size=20).next_to(actual_arrow3, UP, buff=0.08)
        image_label3 = Text("40 mm", color=BLACK, font_size=20).next_to(ruler3, DOWN, buff=0.08)

        self.play(FadeIn(cheek, shift=RIGHT * 0.2), run_time=2)
        self.wait(0.5)
        self.play(GrowArrow(actual_arrow3), FadeIn(actual_label3), run_time=1.8)
        self.wait(0.3)
        self.add(ruler3)
        self.play(ruler3.animate.move_to(ruler3_target), run_time=1.3, rate_func=smooth)
        self.play(FadeIn(image_label3), run_time=0.6)
        self.wait(1)

        cheek_calc1 = Text("50 µm = 0.05 mm", color=BLACK, font_size=24)
        cheek_calc2 = Text("Magnification = 40 ÷ 0.05", color=BLACK, font_size=24)
        cheek_calc3 = Text("Magnification = 800", color=BLACK, font_size=28)
        cheek_answer = self.formula_box("Magnification = ×800", fill="#dff2a4", w=3.3, h=0.52, font_size=22)

        calc_group3 = VGroup(cheek_calc1, cheek_calc2, cheek_calc3, cheek_answer).arrange(
            DOWN, aligned_edge=LEFT, buff=0.24
        ).to_edge(LEFT, buff=0.8).shift(DOWN * 2.0)

        self.play(Write(cheek_calc1), run_time=1.8)
        self.wait(0.7)
        self.play(Write(cheek_calc2), run_time=1.8)
        self.wait(0.7)
        self.play(FadeIn(cheek_calc3, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(cheek_answer, shift=UP * 0.15), run_time=1.5)
        self.wait(2.5)

        # ----------------------------
        # Scene 8: Finding actual size
        # ----------------------------
        actual_title = Text("Finding Actual Size", color=BLACK, font_size=38)
        actual_body = Paragraph(
            "Image size = 24 mm",
            "Magnification = ×600",
            alignment="left",
            color=BLACK,
            font_size=24,
            line_spacing=0.8,
        )

        actual_left = VGroup(actual_title, actual_body).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).to_edge(LEFT, buff=0.8).shift(UP * 1.0)

        self.play(
            FadeOut(example3_left),
            FadeOut(cheek),
            FadeOut(ruler3),
            FadeOut(actual_arrow3),
            FadeOut(actual_label3),
            FadeOut(image_label3),
            FadeOut(calc_group3),
            FadeIn(actual_left, shift=UP * 0.2),
            run_time=2.5,
        )

        actual_calc1 = Text("Actual size = image size ÷ magnification", color=BLACK, font_size=24)
        actual_calc2 = Text("Actual size = 24 ÷ 600", color=BLACK, font_size=24)
        actual_calc3 = Text("Actual size = 0.04 mm", color=BLACK, font_size=28)
        actual_calc4 = Text("0.04 mm = 40 µm", color=BLACK, font_size=24)
        actual_answer = self.formula_box("Answer: 0.04 mm or 40 µm", fill="#d7e9ff", w=4.4, h=0.52, font_size=20)

        actual_group = VGroup(
            actual_calc1, actual_calc2, actual_calc3, actual_calc4, actual_answer
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.24).move_to(RIGHT * 2.7 + DOWN * 0.1)

        self.play(Write(actual_calc1), run_time=2)
        self.wait(0.7)
        self.play(Write(actual_calc2), run_time=1.8)
        self.wait(0.7)
        self.play(FadeIn(actual_calc3, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(actual_calc4, shift=UP * 0.15), run_time=1.5)
        self.wait(0.7)
        self.play(FadeIn(actual_answer, shift=UP * 0.15), run_time=1.5)
        self.wait(2.5)

        # ----------------------------
        # Scene 9: Recap
        # ----------------------------
        recap_title = Text("Exam Tips", color=BLACK, font_size=38)
        tips = BulletedList(
            "Write the formula first",
            "Make sure the units match",
            "Show each calculation step clearly",
            "Give magnification as × number",
            color=BLACK,
            font_size=22,
        )
        tip_box = self.formula_box("Triangle reminder: I A M", fill="#fff2a8", w=3.3, h=0.52, font_size=22)

        recap_group = VGroup(recap_title, tips, tip_box).arrange(
            DOWN, aligned_edge=LEFT, buff=0.35
        ).move_to(ORIGIN)

        self.play(
            FadeOut(actual_left),
            FadeOut(actual_group),
            FadeOut(triangle_group),
            FadeOut(i_text),
            FadeOut(a_text),
            FadeOut(m_text),
            run_time=2.5,
        )
        self.play(FadeIn(recap_group, shift=UP * 0.2), run_time=2)
        self.wait(3)

    def formula_box(self, text, fill, w=5.0, h=0.5, font_size=20):
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
            fill_color="#66b3ff",
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

    def create_teacher_hand(self):
        """Stylized hand for covering the IAM triangle (teacher style)."""
        # Skin tone
        skin = "#e8c4a0"
        # Palm
        palm = RoundedRectangle(
            width=1.4, height=1.0, corner_radius=0.25,
            fill_color=skin, fill_opacity=1, stroke_color=BLACK, stroke_width=1,
        )
        # Fingers (thumb and four fingers)
        thumb = Ellipse(width=0.35, height=0.6, fill_color=skin, fill_opacity=1, stroke_width=0.5).rotate(-40 * DEGREES)
        thumb.next_to(palm, LEFT + DOWN * 0.2, buff=-0.1)
        f1 = RoundedRectangle(width=0.25, height=0.5, corner_radius=0.1, fill_color=skin, fill_opacity=1, stroke_width=0.5)
        f2 = f1.copy()
        f3 = f1.copy()
        f4 = RoundedRectangle(width=0.2, height=0.35, corner_radius=0.08, fill_color=skin, fill_opacity=1, stroke_width=0.5)
        f1.next_to(palm, UP + RIGHT * 0.35, buff=-0.05)
        f2.next_to(palm, UP + RIGHT * 0.1, buff=-0.05)
        f3.next_to(palm, UP, buff=-0.05)
        f4.next_to(palm, UP + LEFT * 0.25, buff=-0.05)
        return VGroup(palm, thumb, f1, f2, f3, f4)
