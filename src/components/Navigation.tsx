import { NavLink } from 'react-router-dom';
import './Navigation.css';

export function Navigation() {
  return (
    <nav className="main-nav" role="navigation" aria-label="Navegación principal">
      <div className="nav-brand">
        <h2>Doña Lina Stock</h2>
      </div>
      <ul className="nav-links">
        <li>
          <NavLink 
            to="/products" 
            className={({ isActive }) => (isActive ? 'active' : '')}
            aria-label="Ir a productos"
          >
            Productos
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/movements" 
            className={({ isActive }) => (isActive ? 'active' : '')}
            aria-label="Ir a movimientos"
          >
            Movimientos
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/purchases" 
            className={({ isActive }) => (isActive ? 'active' : '')}
            aria-label="Ir a compras"
          >
            Compras
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => (isActive ? 'active' : '')}
            aria-label="Ir a configuración"
          >
            Configuración
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
