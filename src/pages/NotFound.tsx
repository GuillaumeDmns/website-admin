import { Link } from "react-router-dom";

import { PageTitle } from "../components/ui";

export default function NotFound() {
  return (
    <>
      <PageTitle title="Page introuvable">Cette adresse ne mène à rien.</PageTitle>
      <p>
        <Link to="/">Retour à la vue d'ensemble</Link>
      </p>
    </>
  );
}
