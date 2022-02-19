import logo from './logo.svg';
import './App.css';
import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Landing from './Landing';

function App() {
  return (
    <BrowserRouter>
      <header className="App-header">
        <Routes>
          <Route path="/" element={<Landing />}></Route>
        <Route path="/incubator" element={<div className="App">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            <code>draggos incubator 🐲</code>
          </p>
        </div>}>

        </Route>
      </Routes>
    </header>

    </BrowserRouter>
    
  );
}

export default App;
