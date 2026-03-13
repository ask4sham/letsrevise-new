from manim import *
config.background_color = WHITE

class LessonScene(Scene):
    def construct(self):

        # Scene 1: Magnification Calculations
        title = Text("Magnification Calculations", font_size=34, font="Arial", color=BLACK).to_edge(UP, buff=0.4)
        text = Text("Magnification Calculations. Learn how to\nuse a light microscope and calculate\nmagnification from image and actual sizes.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(10).next_to(title, DOWN, buff=0.5)
        self.play(FadeIn(title), FadeIn(text))
        self.wait(6)

        self.clear()
        
        # Scene 2: Cells and Microscopes
        title = Text("Cells and Microscopes", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Cells and Microscopes.\n\nLight microscopes use lenses to magnify\nsmall objects. You can see cells, tissues,\nand their structures clearly.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        place = ImageMobject("C:\\Users\\ask4s\\OneDrive\\Desktop\\letsrevise-new\\backend\\services\\videoGenerator\\assets\\microscope.png")
        place.scale_to_fit_width(4).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(12)

        self.clear()
        
        # Scene 3: Microscope Views
        title = Text("Microscope Views", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Microscope Views.\n\nWhen you look through the eyepiece you see\na micrograph—the magnified image.\nDifferent specimens show different cell\ntypes.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        rect = RoundedRectangle(corner_radius=0.12, width=3, height=2, stroke_opacity=0, fill_color=GREY_D, fill_opacity=0.35).to_edge(RIGHT)
        label = Text("Microscope", font_size=20, font="Arial", color=BLACK).next_to(rect, DOWN)
        place = VGroup(rect, label)
        self.play(FadeIn(place))
        self.wait(14)

        self.clear()
        
        # Scene 4: The Magnification Formula
        title = Text("The Magnification Formula", font_size=34, font="Arial", color=BLACK).to_edge(UP, buff=0.4)
        self.play(FadeIn(title))
        text = Text("The Magnification Formula.\n\nMagnification equals image size divided by\nactual size. Remember this for your exam.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.4)
        self.play(FadeIn(text))
        place = Text("Magnification = Image / Actual", font_size=24, font="Arial", color=BLACK)
        place.scale_to_fit_width(6).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(8)

        self.clear()
        
        # Scene 5: The IAM Triangle
        title = Text("The IAM Triangle", font_size=34, font="Arial", color=BLACK).to_edge(UP, buff=0.4)
        self.play(FadeIn(title))
        text = Text("The IAM Triangle.\n\nUse the triangle to remember: Image =\nMagnification × Actual size. Cover the one\nyou want to find.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.4)
        self.play(FadeIn(text))
        place = ImageMobject("C:\\Users\\ask4s\\OneDrive\\Desktop\\letsrevise-new\\backend\\services\\videoGenerator\\assets\\iam-triangle.png")
        place.scale_to_fit_width(4.5).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(12)

        self.clear()
        
        # Scene 6: Worked Example: Plant Cell
        title = Text("Worked Example: Plant Cell", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Worked Example: Plant Cell.\n\nA plant cell is magnified. The image is 12\nmm wide. The actual cell is 0.03 mm. Find\nthe magnification.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        place = ImageMobject("C:\\Users\\ask4s\\OneDrive\\Desktop\\letsrevise-new\\backend\\services\\videoGenerator\\assets\\plant-cell.png")
        place.scale_to_fit_width(4).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(10)

        self.clear()
        
        # Scene 7: Measuring the Image
        title = Text("Measuring the Image", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Measuring the Image.\n\nUse a ruler to measure the image size on\nthe photograph or screen. Convert to\nmillimetres for the formula.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        rect = RoundedRectangle(corner_radius=0.12, width=3, height=2, stroke_opacity=0, fill_color=GREY_D, fill_opacity=0.35).to_edge(RIGHT)
        label = Text("Cell", font_size=20, font="Arial", color=BLACK).next_to(rect, DOWN)
        place = VGroup(rect, label)
        self.play(FadeIn(place))
        self.wait(12)

        self.clear()
        
        # Scene 8: Worked Example Answer
        title = Text("Worked Example Answer", font_size=34, font="Arial", color=BLACK).to_edge(UP, buff=0.4)
        self.play(FadeIn(title))
        text = Text("Worked Example Answer.\n\nMagnification = 12 mm ÷ 0.03 mm = 400×.\nAlways give your answer as a number with ×\nor 'times'.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.4)
        self.play(FadeIn(text))
        place = Text("Magnification = Image / Actual", font_size=24, font="Arial", color=BLACK)
        place.scale_to_fit_width(6).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(8)

        self.clear()
        
        # Scene 9: Exam-Style Question
        title = Text("Exam-Style Question", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Exam-Style Question.\n\nA root hair cell image measures 8 mm. The\nactual cell is 0.04 mm long. Calculate the\nmagnification.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        place = ImageMobject("C:\\Users\\ask4s\\OneDrive\\Desktop\\letsrevise-new\\backend\\services\\videoGenerator\\assets\\root-hair-cell.png")
        place.scale_to_fit_width(4).to_edge(RIGHT)
        self.play(FadeIn(place))
        self.wait(10)

        self.clear()
        
        # Scene 10: Exam-Style Answer
        title = Text("Exam-Style Answer", font_size=34, font="Arial", color=BLACK).to_corner(UL, buff=0.5)
        self.play(FadeIn(title))
        text = Text("Exam-Style Answer.\n\nMagnification = 8 ÷ 0.04 = 200×. Check\nunits: both in mm, so they cancel. Always\nshow your working.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(5.5).to_edge(LEFT).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(text))
        rect = RoundedRectangle(corner_radius=0.12, width=3, height=2, stroke_opacity=0, fill_color=GREY_D, fill_opacity=0.35).to_edge(RIGHT)
        label = Text("Cell", font_size=20, font="Arial", color=BLACK).next_to(rect, DOWN)
        place = VGroup(rect, label)
        self.play(FadeIn(place))
        self.wait(12)

        self.clear()
        
        # Scene 11: Summary
        title = Text("Summary", font_size=34, font="Arial", color=BLACK).to_edge(UP, buff=0.4)
        text = Text("Summary.\n\nRemember: magnification = image size ÷\nactual size. Use the IAM triangle to\nrearrange. Show units and working in your\nanswers.", font_size=24, font="Arial", color=BLACK)
        text.scale_to_fit_width(10).next_to(title, DOWN, buff=0.5)
        self.play(FadeIn(title), FadeIn(text))
        self.wait(8)
