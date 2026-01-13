const MATERIAIS_DB = {
    "304": 8.00, "430": 7.74, "316": 7.98,
    "galv": 7.87, "1020": 7.85, 
    "alu": 2.70, "lat": 8.50, "cob": 8.96, "brz": 8.80, "tit": 4.50,
    "nyl": 1.14, "uhmw": 0.94
};

let orcamento = [];
let totalItensAcumulado = 0;
let totalPesoAcumulado = 0;
let idAtual = "";
let dataValidade = "";
let meuGrafico = null;

window.onload = function() {
    configurarDataEId();
    atualizarListaHistorico();
    
    let salvo = localStorage.getItem('jl_orcamento_temp');
    if (salvo) carregarDadosNaTela(JSON.parse(salvo));
};

function lerNumero(id) {
    let valorRaw = document.getElementById(id).value;
    if (!valorRaw) return 0;
    let valorCorrigido = valorRaw.toString().replace(',', '.');
    return parseFloat(valorCorrigido);
}

function adicionarTubo() {
    let matKey = document.getElementById("tipoMaterial").value;
    let densidade = MATERIAIS_DB[matKey] || 8.0;
    let precoKg = lerNumero("precoKg");
    let formato = document.getElementById("formatoTubo").value;
    
    let mA = lerNumero("medidaTubo") / 1000;
    let esp = lerNumero("espessuraTubo") / 1000;
    let compTotal = lerNumero("comprimentoTubo");

    if (precoKg <= 0) { alert("Preencha o preço do Kg!"); return; }
    if (mA <= 0 || compTotal <= 0) { alert("Preencha as medidas!"); return; }
    
    if (formato !== "macico") {
        if (esp <= 0) { alert("Preencha a Parede (mm)!"); return; }
        if (esp * 2 >= mA) { alert("Parede muito grossa para a bitola!"); return; }
    }

    let area = 0;
    if (formato === "quadrado") area = (mA * mA) - (Math.pow(mA - (2 * esp), 2));
    else if (formato === "retangular") {
        let mB = lerNumero("medidaTubo2") / 1000;
        if (mB <= 0) { alert("Preencha Bitola B!"); return; }
        area = (mA * mB) - ((mA - 2 * esp) * (mB - 2 * esp));
    } else if (formato === "redondo") {
        area = Math.PI * (Math.pow(mA / 2, 2) - Math.pow((mA / 2) - esp, 2));
    } else { area = Math.PI * Math.pow(mA / 2, 2); }

    if (area <= 0 || isNaN(area)) return;

    let peso = area * compTotal * (densidade * 1000);
    let custo = peso * precoKg;

    orcamento.push({ 
        descricao: `Tubo ${matKey.toUpperCase()} ${formato} (${compTotal}m lin.)`, 
        peso: peso, custo: custo 
    });
    atualizarTabela();
}

function adicionarChapa() {
    let matKey = document.getElementById("tipoMaterial").value;
    let densidade = MATERIAIS_DB[matKey] || 8.0;
    let precoKg = lerNumero("precoKg");
    let comp_mm = lerNumero("comprimento");
    let larg_mm = lerNumero("largura");
    let qtd = lerNumero("qtdChapa") || 1;
    let esp = parseFloat(document.getElementById("espessura").value);

    if (!comp_mm || !larg_mm || !precoKg) { alert("Preencha medidas e preço!"); return; }

    let pesoTotal = (comp_mm / 1000) * (larg_mm / 1000) * (esp / 1000) * (densidade * 1000) * qtd;
    let custo = pesoTotal * precoKg;

    orcamento.push({ 
        descricao: `${qtd}x Chapa ${matKey.toUpperCase()} ${esp}mm (${comp_mm}x${larg_mm}mm)`, 
        peso: pesoTotal, custo: custo 
    });
    atualizarTabela();
}

// --- FUNÇÃO DE SERVIÇO COM UNIDADE VARIÁVEL ---
function adicionarServico() {
    let desc = document.getElementById("descServico").value || "Serviço";
    let unidade = document.getElementById("unidadeServico").value;
    let qtd = lerNumero("qtdServico");
    let valorUnit = lerNumero("valorServico");
    
    if (qtd <= 0 || valorUnit <= 0) { alert("Preencha Quantidade e Valor!"); return; }
    
    let labelUnidade = "";
    if(unidade === "m") labelUnidade = "m lin.";
    else if(unidade === "m2") labelUnidade = "m²";
    else labelUnidade = "un.";

    orcamento.push({ 
        descricao: `${desc} (${qtd} ${labelUnidade})`, 
        peso: 0, 
        custo: qtd * valorUnit 
    });
    atualizarTabela();
}

function adicionarAcessorio() {
    let nome = document.getElementById("nomeAcessorio").value;
    let valor = lerNumero("valorAcessorio");
    if (!nome || !valor) return;
    orcamento.push({ descricao: nome, peso: 0, custo: valor });
    atualizarTabela();
}

function atualizarTabela() {
    let tbody = document.getElementById("listaItens");
    tbody.innerHTML = "";
    totalItensAcumulado = 0;
    totalPesoAcumulado = 0;
    orcamento.forEach((item, i) => {
        totalItensAcumulado += item.custo;
        totalPesoAcumulado += item.peso || 0;
        tbody.innerHTML += `<tr><td>${item.descricao}</td><td align="right">R$ ${item.custo.toFixed(2)}</td><td><button class="btn-del" onclick="removerItem(${i})">x</button></td></tr>`;
    });
    document.getElementById("totalMaterial").innerText = "R$ " + totalItensAcumulado.toFixed(2);
    document.getElementById("pesoTotalDisplay").innerText = totalPesoAcumulado.toFixed(2) + " kg";
    salvarProgresso();
    calcularTotalFinal();
}

function calcularFrete() {
    let tipo = document.getElementById("tipoFrete").value;
    let valor = 0;
    if (tipo === "proprio") {
        let km = lerNumero("distanciaKm");
        let cons = lerNumero("consumoVeiculo") || 1;
        let precoL = lerNumero("precoCombustivel");
        valor = (km / cons) * precoL;
    } else valor = lerNumero("valorFreteTerceiro");
    document.getElementById("valorFrete").value = valor.toFixed(2);
    calcularTotalFinal();
}

function calcularTotalFinal() {
    let extra = lerNumero("custoExtras");
    let mo = lerNumero("custoMaoObra");
    let margem = lerNumero("margemLucro");
    let frete = parseFloat(document.getElementById("valorFrete").value) || 0;
    let desconto = lerNumero("descontoVenda");
    
    let custoTotal = totalItensAcumulado + extra + mo;
    let vendaBruta = custoTotal / (1 - (margem / 100));
    let totalFinal = vendaBruta + frete - desconto;
    
    document.getElementById("custoProducao").innerText = "R$ " + custoTotal.toFixed(2);
    document.getElementById("precoVendaFinal").innerText = "R$ " + totalFinal.toFixed(2);
    document.getElementById("lucroLiquido").innerText = "Lucro Líq: R$ " + (vendaBruta - custoTotal).toFixed(2);
    
    atualizarGrafico(totalItensAcumulado, mo, extra + frete, vendaBruta - custoTotal);
}

// --- UTILITÁRIOS ---
function salvarNoHistorico() {
    let nome = document.getElementById("nomeCliente").value || "Sem Nome";
    let historico = JSON.parse(localStorage.getItem('jl_historico') || "[]");
    let novoItem = {
        id: Date.now(), id_visivel: idAtual, nome: nome, data: new Date().toLocaleString('pt-BR'),
        total_txt: document.getElementById("precoVendaFinal").innerText, itens: orcamento,
        endereco: document.getElementById("enderecoEntrega").value,
        material: document.getElementById("tipoMaterial").value, precoKg: document.getElementById("precoKg").value,
        obs: document.getElementById("obsOrcamento").value,
        frete: { tipo: document.getElementById("tipoFrete").value, valor: document.getElementById("valorFrete").value },
        pagto: document.getElementById("formaPagamento").value, prazo: document.getElementById("prazoEntrega").value
    };
    historico.unshift(novoItem);
    if (historico.length > 20) historico.pop();
    localStorage.setItem('jl_historico', JSON.stringify(historico));
    atualizarListaHistorico();
    alert("Salvo!");
}
function atualizarListaHistorico() {
    let lista = document.getElementById("listaHistorico");
    let historico = JSON.parse(localStorage.getItem('jl_historico') || "[]");
    if (historico.length === 0) { lista.innerHTML = '<small style="padding:10px; display:block; color:#888">Vazio</small>'; return; }
    lista.innerHTML = historico.map(h => `<div class="item-hist" onclick="recuperarHistorico(${h.id})"><div style="font-weight:bold; color:#0056b3">${h.nome}</div><div style="font-size:10px; color:#666">${h.data} • ${h.total_txt}</div></div>`).join("");
}
function recuperarHistorico(id) {
    if(!confirm("Carregar?")) return;
    let item = JSON.parse(localStorage.getItem('jl_historico') || "[]").find(h => h.id === id);
    if (item) carregarDadosNaTela(item);
}
function carregarDadosNaTela(dados) {
    orcamento = dados.itens || [];
    document.getElementById("nomeCliente").value = dados.nome || dados.cliente || "";
    document.getElementById("obsOrcamento").value = dados.obs || "";
    document.getElementById("formaPagamento").value = dados.pagto || "";
    document.getElementById("prazoEntrega").value = dados.prazo || "";
    if(dados.precoKg) document.getElementById("precoKg").value = dados.precoKg;
    atualizarTabela();
}
function atualizarGrafico(mat, mo, ext, lucro) {
    let ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if (meuGrafico) meuGrafico.destroy();
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Materiais', 'Mão de Obra', 'Logística/Extras', 'Lucro'],
            datasets: [{ data: [mat, mo, ext, lucro > 0 ? lucro : 0], backgroundColor: ['#34495e', '#e67e22', '#95a5a6', '#2ecc71'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
function removerItem(i) { orcamento.splice(i, 1); atualizarTabela(); }
function limparOrcamento() { if(confirm("Limpar tudo?")) { localStorage.removeItem('jl_orcamento_temp'); location.reload(); } }
function configurarDataEId() {
    idAtual = "#" + Math.floor(Date.now() / 1000).toString().slice(-4);
    document.getElementById("idOrcamento").innerText = idAtual;
    let validade = new Date();
    validade.setDate(validade.getDate() + 5);
    document.getElementById("dataValidade").innerText = validade.toLocaleDateString('pt-BR');
}
function filtrarMateriais() {
    let busca = document.getElementById("buscaMaterial").value.toLowerCase();
    let select = document.getElementById("tipoMaterial");
    let options = select.getElementsByTagName("option");
    for (let opt of options) {
        opt.style.display = opt.text.toLowerCase().includes(busca) ? "block" : "none";
    }
    for (let opt of options) { if (opt.style.display !== "none") { select.value = opt.value; break; } }
}
function mudarLabelTubo() { document.getElementById("boxMedida2").style.display = document.getElementById("formatoTubo").value === "retangular" ? "flex" : "none"; }
function salvarProgresso() { /* Opcional */ }
function alternarTipoFrete() { 
    document.getElementById("boxFreteProprio").style.display = document.getElementById("tipoFrete").value === "proprio" ? "block" : "none"; 
    document.getElementById("boxFreteTerceiro").style.display = document.getElementById("tipoFrete").value === "terceiro" ? "block" : "none"; 
    calcularFrete();
}
function enviarWhatsApp() {
    let cliente = document.getElementById("nomeCliente").value || "Cliente";
    let obs = document.getElementById("obsOrcamento").value;
    let total = document.getElementById("precoVendaFinal").innerText;
    let pagto = document.getElementById("formaPagamento").value;
    let txt = `*JL EQUIPAMENTOS - ORÇAMENTO ${idAtual}*\n👤 Cliente: ${cliente}\n📅 Validade: ${document.getElementById("dataValidade").innerText}\n\n*ITENS:*\n`;
    orcamento.forEach(i => txt += `▪ ${i.descricao}\n`);
    if(obs) txt += `\n📝 *OBS:* ${obs}\n`;
    if(pagto) txt += `💳 *Pagamento:* ${pagto}\n`;
    txt += `\n💰 *VALOR TOTAL: ${total}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}
function imprimirCliente() { document.body.classList.add('print-client'); window.print(); document.body.classList.remove('print-client'); }
function gerarExcelInterno() {
    let csv = `ITEM;VALOR\n`;
    orcamento.forEach(i => csv += `${i.descricao};${i.custo.toFixed(2).replace('.', ',')}\n`);
    let blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Orcamento_${idAtual}.csv`;
    link.click();
}
function abrirMapa() { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(document.getElementById("enderecoEntrega").value)}`, '_blank'); }
function abrirWaze() { window.open(`https://waze.com/ul?q=${encodeURIComponent(document.getElementById("enderecoEntrega").value)}`, '_blank'); }