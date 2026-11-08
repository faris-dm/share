// import React, { useState } from "react";

// function App() {
//   const [login, setLogin] = useState(true);
//   function btnToggle() {
//     setLogin(login === true ? false : true);
//   }
//   return (
//     <div>
//       <button> </button>
//       <p>
//         {" "}
//         {(login === true && (
//           <div>
//             <p>welcome back</p>
//             <button onClick={btnToggle}>logout</button>
//           </div>
//         )) || (
//           <div>
//             <p>login and be part of the community</p>
//             <button onClick={btnToggle}>Login</button>
//           </div>
//         )}
//       </p>
//     </div>
//   );
// }

// export default App;rate

import React, { useState } from "react";

function App() {
  const [show, setShow] = useState(true);
  function change() {
    setShow(!show);
  }
  return (
    <div>
      <div>
        <p>input your password</p>
        <input type={show ? "text" : "password"} className="border" />
        <p onClick={change}>{show ? "hide" : "show"}</p>
      </div>
    </div>
  );
}

export default App;
