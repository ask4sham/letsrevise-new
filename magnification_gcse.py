"""Manim animation for GCSE Magnification - magnification = image size ÷ actual size."""
from manim import *


class MagnificationGCSE(Scene):
    """GCSE Biology magnification formula animation."""

    def construct(self):
        title = Text("Magnification", font_size=48).to_edge(UP)
        self.play(Write(title))

        formula = Text(
            "Magnification = Image size ÷ Actual size",
            font_size=36,
        )
        self.play(Write(formula))
        self.wait(1)

        labels = VGroup(
            Text("Image size = size on diagram/drawing", font_size=28),
            Text("Actual size = real size of the object", font_size=28),
        ).arrange(DOWN, aligned_edge=LEFT).next_to(formula, DOWN, buff=0.8)
        self.play(FadeIn(labels))
        self.wait(2)

        self.play(FadeOut(labels))
        rearrange = Text(
            "Actual size = Image size ÷ Magnification",
            font_size=36,
        ).move_to(formula)
        self.play(Transform(formula, rearrange))
        self.wait(1)

        self.play(*[FadeOut(mob) for mob in self.mobjects])
