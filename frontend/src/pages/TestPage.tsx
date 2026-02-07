import React from "react";

const TestPage: React.FC = () => {
  return (
    <div style={{ padding: "50px", background: "red", color: "white" }}>
      <h1>TEST PAGE - CAN YOU SEE THIS?</h1>
      <p>If you see this red box, React is working!</p>
      <input type="text" placeholder="Test input" />
      <button>Test Button</button>
    </div>
  );
};

export default TestPage;
