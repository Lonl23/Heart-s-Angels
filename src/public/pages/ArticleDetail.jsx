import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../i18n/index.jsx'

const ARTICLES_STATIC = {
  'regards-croises-une-premiere-mission-inoubliable': {
    titre_fr:"[REGARDS CROISÉS] : Une première mission inoubliable",
    contenu_fr:`Ce samedi 28 mars restera gravé dans le cœur de l'équipe Heart's Angels ASBL. Deux nouveaux bénévoles nous accompagnaient pour leur toute première réalisation de souhait. Professionnels de santé au quotidien, ils nous partagent ce que cette journée a changé pour eux.

**Témoignage de l'infirmière bénévole :**
« Aujourd'hui restera une journée profondément marquante dans mon parcours d'infirmière bénévole. Pour ce premier souhait, j'étais habitée par le stress face à l'imminence de la situation, mais j'ai vite été rassurée par l'accueil de l'équipe. L'émotion a laissé place à une atmosphère remplie d'amour. »

Un immense MERCI à eux deux pour leur confiance et leur grand cœur. Bienvenue officiellement dans la famille Heart's Angels ASBL !`,
    image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
    publie_le:'2026-03-28', categorie:'association'
  },
  'lengagement-au-coeur-de-laction-decouvrez-francine': {
    titre_fr:"L'engagement au cœur de l'action : Découvrez Francine",
    contenu_fr:`Maman de 4 enfants et bientôt 7 fois grand-mère, Francine incarne parfaitement l'esprit de Heart's Angels ASBL : la solidarité, l'esprit d'équipe et la douceur. Merci Francine pour ton énergie et pour tous ces sourires que tu aides à faire naître !

Vous aussi, vous voulez soutenir nos actions ? Devenez bénévole ou faites un don pour nous aider à réaliser de nouveaux souhaits.`,
    image_url:'https://www.heartsangels.be/wp-content/uploads/2023/06/carine_carlier-1.jpg',
    publie_le:'2026-04-27', categorie:'association'
  },
}

export default function ArticleDetail() {
  const { slug } = useParams()
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // D'abord chercher dans le statique
    if (ARTICLES_STATIC[slug]) {
      setArticle(ARTICLES_STATIC[slug])
      setLoading(false)
      return
    }
    // Sinon chercher en BDD
    supabase.from('articles').select('*').eq('slug', slug).eq('publie', true).single()
      .then(({ data }) => { setArticle(data); setLoading(false) })
  }, [slug])

  if (loading) return <div style={{ minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#1BB0CE', fontFamily:'DM Sans,sans-serif' }}>Chargement…</div>
  if (!article) return <Navigate to="/actualites" replace />

  const titre = article[`titre_${lang}`] || article.titre_fr
  const contenu = article[`contenu_${lang}`] || article.contenu_fr || ''

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      {/* Hero article */}
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'60px 20px 0', position:'relative', overflow:'hidden' }}>
        {article.image_url && <div style={{ position:'absolute', inset:0, background:`url(${article.image_url}) center/cover`, opacity:.2 }}/>}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7))' }}/>
        <div style={{ position:'relative', zIndex:1, maxWidth:860, margin:'0 auto' }}>
          <Link to="/actualites" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'rgba(255,255,255,.6)', textDecoration:'none', fontSize:13, marginBottom:20 }}>← Retour aux actualités</Link>
          {article.publie_le && <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:12 }}>📅 {new Date(article.publie_le).toLocaleDateString('fr-BE', { day:'numeric', month:'long', year:'numeric' })}</div>}
          <h1 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.8rem,4vw,3rem)', fontWeight:500, color:'white', lineHeight:1.2, marginBottom:32 }}>{titre}</h1>
        </div>
      </section>

      {/* Contenu */}
      <section style={{ padding:'52px 20px 80px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          {article.image_url && (
            <img src={article.image_url} alt={titre} style={{ width:'100%', maxHeight:420, objectFit:'cover', borderRadius:14, marginBottom:36, boxShadow:'0 4px 20px rgba(27,176,206,.1)' }} />
          )}
          <div style={{ fontSize:15.5, color:'#1A1514', lineHeight:1.9 }}>
            {contenu.split('\n').map((p, i) => {
              if (!p.trim()) return <br key={i} />
              if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ display:'block', marginBottom:8 }}>{p.slice(2,-2)}</strong>
              if (p.startsWith('#')) return <h2 key={i} style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:500, color:'#1A1514', margin:'28px 0 12px' }}>{p.replace(/^#+\s*/,'')}</h2>
              return <p key={i} style={{ marginBottom:16 }}>{p}</p>
            })}
          </div>
          <div style={{ marginTop:40, padding:'20px 24px', background:'#E6F7FA', borderRadius:12, display:'flex', gap:14, alignItems:'center' }}>
            <span style={{ fontSize:'2rem' }}>❤️</span>
            <div>
              <div style={{ fontWeight:600, color:'#0E4A5A', marginBottom:4 }}>Rejoindre Heart's Angels</div>
              <p style={{ fontSize:13.5, color:'#0E7A93', margin:0 }}>
                <Link to="/devenir-benevole" style={{ color:'#1BB0CE', fontWeight:600 }}>Devenez bénévole</Link>
                {' ou '}
                <Link to="/nous-soutenir" style={{ color:'#1BB0CE', fontWeight:600 }}>soutenez notre mission</Link>
                {' — chaque aide compte.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}