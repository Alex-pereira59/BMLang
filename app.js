// IMPORTACIÓN DE HOOKS DE REACT
const { useState } = React;

const BMLangIDE = () => {
  // ESTADOS
  const [code, setCode] = useState(`MAIN {
  DEC x, y, resultado;
  INPUT x;
  INPUT y;
  resultado = x + y * 2;
  OUTPUT resultado
}`);
  
  const [output, setOutput] = useState('');
  const [tokens, setTokens] = useState([]);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('output');
  const [isCompiling, setIsCompiling] = useState(false);

  const TOKEN_NAMES_ES = {
    'COMMENT': 'COMENTARIO',
    'KEYWORD': 'PALABRA_RESERVADA',
    'LOGICAL_OP': 'OPERADOR_LOGICO',
    'COMPARISON': 'COMPARACION',
    'NUMBER': 'NUMERO',
    'IDENTIFIER': 'IDENTIFICADOR',
    'ASSIGN': 'ASIGNACION',
    'OPERATOR': 'OPERADOR',
    'LPAREN': 'PARENTESIS_IZQ',
    'RPAREN': 'PARENTESIS_DER',
    'LBRACE': 'LLAVE_IZQ',
    'RBRACE': 'LLAVE_DER',
    'SEMICOLON': 'PUNTO_COMA',
    'COMMA': 'COMA',
    'WHITESPACE': 'ESPACIO'
  };

  // ANALIZADOR LÉXICO CON VALIDACIONES SEMÁNTICAS
  const tokenize = (sourceCode) => {
    const tokenList = [];
    const errorList = [];
    const declaredVars = new Set(); // Para validaciones semánticas
    
    const patterns = [
      { type: 'COMMENT', regex: /\/\*[\s\S]*?\*\// },
      { type: 'KEYWORD', regex: /\b(MAIN|DEC|INPUT|OUTPUT|IF|ELSE|WHILE|FOR)\b/ },
      { type: 'LOGICAL_OP', regex: /&&|\|\|/ },
      { type: 'COMPARISON', regex: /<=|>=|==|<>|[<>]/ },
      { type: 'NUMBER', regex: /\d+/ },
      { type: 'IDENTIFIER', regex: /[a-zA-Z][a-zA-Z0-9]*/ },
      { type: 'ASSIGN', regex: /=/ },
      { type: 'OPERATOR', regex: /[+\-*/^]/ },
      { type: 'LPAREN', regex: /\(/ },
      { type: 'RPAREN', regex: /\)/ },
      { type: 'LBRACE', regex: /\{/ },
      { type: 'RBRACE', regex: /\}/ },
      { type: 'SEMICOLON', regex: /;/ },
      { type: 'COMMA', regex: /,/ },
      { type: 'WHITESPACE', regex: /\s+/ }
    ];

    let pos = 0;
    let line = 1;
    let col = 1;

    while (pos < sourceCode.length) {
      let matched = false;
      
      for (const pattern of patterns) {
        const remaining = sourceCode.slice(pos);
        const match = remaining.match(pattern.regex);
        
        if (match && match.index === 0) {
          const value = match[0];
          
          if (pattern.type !== 'WHITESPACE') {
            tokenList.push({
              type: pattern.type,
              typeES: TOKEN_NAMES_ES[pattern.type],
              value: value,
              line: line,
              column: col
            });
          }
          
          pos += value.length;
          
          for (let char of value) {
            if (char === '\n') {
              line++;
              col = 1;
            } else {
              col++;
            }
          }
          
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        errorList.push({
          type: 'ERROR_LEXICO',
          message: `Carácter no reconocido: '${sourceCode[pos]}'`,
          detail: `El carácter '${sourceCode[pos]}' no es válido en BMLang`,
          line: line,
          column: col
        });
        pos++;
        col++;
      }
    }
    
    return { tokens: tokenList, errors: errorList };
  };

  // ANALIZADOR SINTÁCTICO CON VALIDACIONES SEMÁNTICAS
  const parse = (tokenList) => {
    let current = 0;
    const errors = [];
    let output = '';
    
    // Variables para validaciones semánticas
    const declaredVars = new Set();
    const usedVars = new Set();
    const initializedVars = new Set();

    const peek = () => tokenList[current];
    const advance = () => tokenList[current++];
    
    const expect = (type, errorType = 'ERROR_SINTACTICO') => {
      const token = peek();
      if (!token) {
        errors.push({
          type: errorType,
          message: `Se esperaba ${TOKEN_NAMES_ES[type]}, pero se encontró el final del archivo`,
          detail: `Falta un token de tipo ${TOKEN_NAMES_ES[type]}`,
          line: tokenList[tokenList.length - 1]?.line || 0,
          column: tokenList[tokenList.length - 1]?.column || 0
        });
        return null;
      }
      
      if (token.type !== type) {
        errors.push({
          type: errorType,
          message: `Se esperaba ${TOKEN_NAMES_ES[type]}, se encontró '${token.value}'`,
          detail: `Token incorrecto en la posición actual`,
          line: token.line,
          column: token.column
        });
        return null;
      }
      return advance();
    };

    const parseProgram = () => {
      output += 'ÁRBOL DE ANÁLISIS SINTÁCTICO\n\n';
      output += '└── Programa\n';
      
      const mainToken = expect('KEYWORD');
      if (mainToken && mainToken.value !== 'MAIN') {
        errors.push({
          type: 'ERROR_SINTACTICO',
          message: `El programa debe comenzar con MAIN, se encontró '${mainToken.value}'`,
          detail: 'Todo programa BMLang debe iniciar con la palabra reservada MAIN',
          line: mainToken.line,
          column: mainToken.column
        });
      }
      
      expect('LBRACE');
      output += '    ├── MAIN\n';
      output += '    ├── {\n';
      
      let sentenceCount = 0;
      while (peek() && peek().type !== 'RBRACE') {
        parseSentencia(sentenceCount === 0 ? '    │' : '    │');
        sentenceCount++;
        
        if (sentenceCount > 1000) {
          errors.push({
            type: 'ERROR_LOGICO',
            message: 'Demasiadas sentencias detectadas',
            detail: 'Posible bucle infinito o código extremadamente largo',
            line: peek()?.line || 0,
            column: 0
          });
          break;
        }
      }
      
      expect('RBRACE');
      output += '    └── }\n';
      
      // Validaciones semánticas finales
      checkUnusedVariables();
      checkUninitializedVariables();
      
      if (errors.length === 0) {
        output += '\n✓ Análisis completado exitosamente\n';
        output += `✓ Total de sentencias: ${sentenceCount}\n`;
        output += `✓ Variables declaradas: ${declaredVars.size}\n`;
      }
    };

    const parseSentencia = (prefix) => {
      const token = peek();
      if (!token) return;

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'DEC': 
            parseDeclaracion(prefix);
            // Punto y coma OBLIGATORIO después de DEC
            if (peek() && peek().type === 'SEMICOLON') {
              advance();
            }
            break;
          case 'INPUT': 
            parseLectura(prefix);
            // Punto y coma OBLIGATORIO después de INPUT
            if (!peek() || peek().type !== 'SEMICOLON') {
              errors.push({
                type: 'ERROR_SINTACTICO',
                message: `Se esperaba PUNTO_COMA después de INPUT`,
                detail: `Todas las sentencias INPUT deben terminar con punto y coma (;)`,
                line: token.line,
                column: token.column
              });
            } else {
              advance();
            }
            break;
          case 'OUTPUT': 
            parseEscritura(prefix);
            // Punto y coma OBLIGATORIO después de OUTPUT
            if (!peek() || peek().type !== 'SEMICOLON') {
              errors.push({
                type: 'ERROR_SINTACTICO',
                message: `Se esperaba PUNTO_COMA después de OUTPUT`,
                detail: `Todas las sentencias OUTPUT deben terminar con punto y coma (;)`,
                line: token.line,
                column: token.column
              });
            } else {
              advance();
            }
            break;
          case 'IF': parseIf(prefix); break;
          case 'WHILE': parseWhile(prefix); break;
          case 'FOR': parseFor(prefix); break;
        }
      } else if (token.type === 'IDENTIFIER') {
        parseAsignacion(prefix);
        // Punto y coma OBLIGATORIO después de asignación
        if (!peek() || peek().type !== 'SEMICOLON') {
          errors.push({
            type: 'ERROR_SINTACTICO',
            message: `Se esperaba PUNTO_COMA después de la asignación`,
            detail: `Todas las asignaciones deben terminar con punto y coma (;)`,
            line: token.line,
            column: token.column
          });
        } else {
          advance();
        }
      } else {
        errors.push({
          type: 'ERROR_SINTACTICO',
          message: `Token inesperado: '${token.value}'`,
          detail: `Se esperaba una sentencia válida (DEC, INPUT, OUTPUT, IF, WHILE, FOR o asignación)`,
          line: token.line,
          column: token.column
        });
        advance(); // Saltar token inválido
      }
    };

    const parseDeclaracion = (prefix) => {
      output += `${prefix}   └── Declaración\n`;
      const decToken = advance(); // DEC
      
      const vars = [];
      const firstVar = expect('IDENTIFIER');
      if (firstVar) {
        vars.push(firstVar.value);
        declaredVars.add(firstVar.value);
        output += `${prefix}       ├── Variable: ${firstVar.value}\n`;
      }
      
      while (peek() && peek().type === 'COMMA') {
        advance();
        const nextVar = expect('IDENTIFIER');
        if (nextVar) {
          if (declaredVars.has(nextVar.value)) {
            errors.push({
              type: 'ERROR_SEMANTICO',
              message: `Variable '${nextVar.value}' ya fue declarada`,
              detail: 'No se puede declarar la misma variable dos veces',
              line: nextVar.line,
              column: nextVar.column
            });
          }
          vars.push(nextVar.value);
          declaredVars.add(nextVar.value);
          output += `${prefix}       ├── Variable: ${nextVar.value}\n`;
        }
      }
      
      // Validar que después de DEC venga punto y coma
      if (!peek() || peek().type !== 'SEMICOLON') {
        const lastToken = tokenList[current - 1];
        errors.push({
          type: 'ERROR_SINTACTICO',
          message: `Se esperaba PUNTO_COMA después de la declaración`,
          detail: `La declaración de variables debe terminar con punto y coma (;)`,
          line: lastToken ? lastToken.line : decToken.line,
          column: lastToken ? lastToken.column + lastToken.value.length : decToken.column
        });
      }
    };

    const parseAsignacion = (prefix) => {
      const variable = expect('IDENTIFIER');
      if (variable) {
        output += `${prefix}   └── Asignación: ${variable.value}\n`;
        
        // Validación semántica: variable debe estar declarada
        if (!declaredVars.has(variable.value)) {
          errors.push({
            type: 'ERROR_SEMANTICO',
            message: `Variable '${variable.value}' no ha sido declarada`,
            detail: `Debe declarar la variable con DEC antes de usarla`,
            line: variable.line,
            column: variable.column
          });
        } else {
          initializedVars.add(variable.value);
        }
      }
      
      expect('ASSIGN');
      parseExpresion(prefix + '       ');
    };

    const parseExpresion = (prefix) => {
      parseTermino(prefix);
      while (peek() && (peek().value === '+' || peek().value === '-')) {
        const op = advance();
        output += `${prefix}├── Operador: ${op.value}\n`;
        parseTermino(prefix);
      }
    };

    const parseTermino = (prefix) => {
      parseFactor(prefix);
      while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '^')) {
        const op = advance();
        output += `${prefix}├── Operador: ${op.value}\n`;
        parseFactor(prefix);
      }
    };

    const parseFactor = (prefix) => {
      const token = peek();
      if (!token) return;

      if (token.type === 'NUMBER') {
        advance();
        output += `${prefix}└── Número: ${token.value}\n`;
      } else if (token.type === 'IDENTIFIER') {
        advance();
        usedVars.add(token.value);
        
        // Validación semántica: variable debe estar declarada
        if (!declaredVars.has(token.value)) {
          errors.push({
            type: 'ERROR_SEMANTICO',
            message: `Variable '${token.value}' no ha sido declarada`,
            detail: 'Intento de usar una variable que no existe',
            line: token.line,
            column: token.column
          });
        }
        
        output += `${prefix}└── Variable: ${token.value}\n`;
      } else if (token.type === 'LPAREN') {
        advance();
        parseExpresion(prefix);
        expect('RPAREN');
      }
    };

    const parseLectura = (prefix) => {
      output += `${prefix}   └── INPUT\n`;
      advance();
      const variable = expect('IDENTIFIER');
      
      if (variable) {
        if (!declaredVars.has(variable.value)) {
          errors.push({
            type: 'ERROR_SEMANTICO',
            message: `Variable '${variable.value}' no ha sido declarada`,
            detail: 'No se puede leer en una variable no declarada',
            line: variable.line,
            column: variable.column
          });
        } else {
          initializedVars.add(variable.value);
        }
        output += `${prefix}       └── Variable: ${variable.value}\n`;
      }
    };

    const parseEscritura = (prefix) => {
      output += `${prefix}   └── OUTPUT\n`;
      advance();
      const variable = expect('IDENTIFIER');
      
      if (variable) {
        usedVars.add(variable.value);
        
        if (!declaredVars.has(variable.value)) {
          errors.push({
            type: 'ERROR_SEMANTICO',
            message: `Variable '${variable.value}' no ha sido declarada`,
            detail: 'No se puede imprimir una variable no declarada',
            line: variable.line,
            column: variable.column
          });
        } else if (!initializedVars.has(variable.value)) {
          errors.push({
            type: 'ERROR_LOGICO',
            message: `Variable '${variable.value}' puede no estar inicializada`,
            detail: 'Intento de imprimir una variable sin valor asignado',
            line: variable.line,
            column: variable.column
          });
        }
        
        output += `${prefix}       └── Variable: ${variable.value}\n`;
      }
    };

    const parseIf = (prefix) => {
      output += `${prefix}   └── IF\n`;
      advance();
      expect('LPAREN');
      parseCondicion(prefix + '       ');
      expect('RPAREN');
      expect('LBRACE');
      
      while (peek() && peek().type !== 'RBRACE') {
        parseSentencia(prefix + '       ');
      }
      
      expect('RBRACE');
      
      if (peek() && peek().value === 'ELSE') {
        advance();
        output += `${prefix}   └── ELSE\n`;
        expect('LBRACE');
        
        while (peek() && peek().type !== 'RBRACE') {
          parseSentencia(prefix + '       ');
        }
        
        expect('RBRACE');
      }
    };

    const parseWhile = (prefix) => {
      output += `${prefix}   └── WHILE\n`;
      advance();
      expect('LPAREN');
      parseCondicion(prefix + '       ');
      expect('RPAREN');
      expect('LBRACE');
      
      while (peek() && peek().type !== 'RBRACE') {
        parseSentencia(prefix + '       ');
      }
      
      expect('RBRACE');
    };

    const parseFor = (prefix) => {
      output += `${prefix}   └── FOR\n`;
      advance();
      expect('LPAREN');
      parseAsignacion(prefix + '       ');
      expect('SEMICOLON');
      parseCondicion(prefix + '       ');
      expect('SEMICOLON');
      parseAsignacion(prefix + '       ');
      expect('RPAREN');
      expect('LBRACE');
      
      while (peek() && peek().type !== 'RBRACE') {
        parseSentencia(prefix + '       ');
      }
      
      expect('RBRACE');
    };

    const parseCondicion = (prefix) => {
      parseExpresion(prefix);
      if (peek() && peek().type === 'COMPARISON') {
        const comp = advance();
        output += `${prefix}├── Comparación: ${comp.value}\n`;
        parseExpresion(prefix);
      }
      
      while (peek() && peek().type === 'LOGICAL_OP') {
        const logic = advance();
        output += `${prefix}├── Op. Lógico: ${logic.value}\n`;
        parseExpresion(prefix);
        if (peek() && peek().type === 'COMPARISON') {
          const comp = advance();
          output += `${prefix}├── Comparación: ${comp.value}\n`;
          parseExpresion(prefix);
        }
      }
    };

    const checkUnusedVariables = () => {
      declaredVars.forEach(varName => {
        if (!usedVars.has(varName)) {
          errors.push({
            type: 'ERROR_LOGICO',
            message: `Variable '${varName}' declarada pero nunca usada`,
            detail: 'Advertencia: variable sin uso en el programa',
            line: 0,
            column: 0
          });
        }
      });
    };

    const checkUninitializedVariables = () => {
      usedVars.forEach(varName => {
        if (declaredVars.has(varName) && !initializedVars.has(varName)) {
          errors.push({
            type: 'ERROR_LOGICO',
            message: `Variable '${varName}' usada sin inicializar`,
            detail: 'Advertencia: variable sin valor inicial',
            line: 0,
            column: 0
          });
        }
      });
    };

    try {
      parseProgram();
    } catch (e) {
      errors.push({
        type: 'ERROR_INTERNO',
        message: 'Error inesperado durante el análisis: ' + e.message,
        detail: 'Error interno del compilador',
        line: 0,
        column: 0
      });
    }

    return { parseOutput: output, errors: errors };
  };

  // MANEJADOR DE COMPILACIÓN
  const handleCompile = () => {
    setIsCompiling(true);
    setOutput('Compilando...');
    setTokens([]);
    setErrors([]);

    setTimeout(() => {
      try {
        // Fase 1: Análisis Léxico
        const { tokens: tokenList, errors: lexicalErrors } = tokenize(code);
        setTokens(tokenList);

        if (lexicalErrors.length > 0) {
          setErrors(lexicalErrors);
          setOutput('Errores léxicos encontrados\n');
          setIsCompiling(false);
          return;
        }

        // Fase 2: Análisis Sintáctico y Semántico
        const { parseOutput, errors: parseErrors } = parse(tokenList);

        if (parseErrors.length > 0) {
          setErrors(parseErrors);
          setOutput('Errores encontrados durante la compilación\n');
          setIsCompiling(false);
          return;
        }

        // Solo si no hay errores, mostrar el árbol
        setOutput('✓ COMPILACIÓN EXITOSA!\n\n' + parseOutput);
        setIsCompiling(false);
      } catch (error) {
        setErrors([{
          type: 'ERROR_INTERNO',
          message: 'Error interno del compilador: ' + error.message,
          detail: ' ',
          line: 0,
          column: 0
        }]);
        setOutput('Error interno del compilador');
        setIsCompiling(false);
      }
    }, 100);
  };

  const handleOpenFile = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      // Validar extensión .bml
      if (!file.name.endsWith('.bml')) {
        alert('Error: Solo se permiten archivos con extensión .bml');
        e.target.value = ''; // Limpiar el input
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setCode(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleSaveFile = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'programa.bml';
    a.click();
    URL.revokeObjectURL(url);
  };

  //encabezado
  return React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'header' },
      React.createElement('h1', null, 'Proyecto BMLang IDE'),
      React.createElement('p', null, 'Basic Mathematical Language Compiler'),
      React.createElement('p', null, 'Andres Gonzalez - Brayan de Leon.')
    ),

    React.createElement('div', { className: 'toolbar' },
      React.createElement('label', { className: 'btn btn-primary' },
        'Abrir .bml',
        React.createElement('input', {
          type: 'file',
          accept: '.bml',
          onChange: handleOpenFile,
          className: 'file-input'
        })
      ),
      React.createElement('button', {
        onClick: handleSaveFile,
        className: 'btn btn-secondary'
      }, 'Guardar'),
      React.createElement('button', {
        onClick: handleCompile,
        className: 'btn btn-success',
        disabled: isCompiling
      }, isCompiling ? 'Compilando...' : 'Compilar')
    ),

    React.createElement('div', { className: 'grid' },
      React.createElement('div', { className: 'panel' },
        React.createElement('div', { className: 'panel-header' },
          React.createElement('h2', null, 'Editor de Código')
        ),
        React.createElement('textarea', {
          value: code,
          onChange: (e) => setCode(e.target.value),
          className: 'editor',
          spellCheck: 'false',
          placeholder: 'Escribe el código BMLang o sube un archivo'
        })
      ),

      React.createElement('div', { className: 'panel' },
        React.createElement('div', { className: 'panel-header' },
          React.createElement('div', { className: 'tabs' },
            React.createElement('button', {
              onClick: () => setActiveTab('output'),
              className: `tab ${activeTab === 'output' ? 'active' : ''}`
            }, 'Salida'),
            React.createElement('button', {
              onClick: () => setActiveTab('tokens'),
              className: `tab ${activeTab === 'tokens' ? 'active' : ''}`
            }, `Tokens (${tokens.length})`),
            React.createElement('button', {
              onClick: () => setActiveTab('errors'),
              className: `tab ${activeTab === 'errors' ? 'active' : ''}`
            }, `Errores${errors.length > 0 ? ` (${errors.length})` : ''}`)
          )
        ),
        React.createElement('div', { className: 'output-area' },
          activeTab === 'output' && React.createElement('pre', { className: 'output-text' },
            output || 'Presiona "Compilar" para ver los resultados'
          ),
          activeTab === 'tokens' && React.createElement('div', { className: 'token-list' },
            tokens.length > 0 ? tokens.map((token, idx) =>
              React.createElement('div', { key: idx, className: 'token-item' },
                React.createElement('span', { className: 'token-type' }, token.typeES),
                React.createElement('span', { className: 'token-arrow' }, '→'),
                React.createElement('span', { className: 'token-value' }, token.value),
                React.createElement('span', { className: 'token-position' },
                  `(L${token.line}:C${token.column})`
                )
              )
            ) : React.createElement('div', { className: 'empty-state' }, 'No hay tokens')
          ),
          activeTab === 'errors' && React.createElement('div', { className: 'error-list' },
            errors.length > 0 ? errors.map((error, idx) =>
              React.createElement('div', { key: idx, className: 'error-item' },
                React.createElement('div', { className: 'error-header' }, `${error.type}`),
                React.createElement('p', { className: 'error-message' }, error.message),
                React.createElement('p', { className: 'error-message' }, `Detalle: ${error.detail}`),
                React.createElement('p', { className: 'error-position' },
                  `Línea ${error.line}, Columna ${error.column}`
                )
              )
            ) : React.createElement('div', { className: 'success-item' },
              React.createElement('span', { className: 'success-text' }, 'No hay errores')
            )
          )
        )
      )
    )
  );
};

ReactDOM.render(React.createElement(BMLangIDE), document.getElementById('root'));