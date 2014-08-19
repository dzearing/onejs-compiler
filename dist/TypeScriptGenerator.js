var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var BaseGenerator = require('./BaseGenerator');

/// <summary>
/// Generates a TypeScript view class from a OneJS template.
/// </summary>
var TypeScriptGenerator = (function (_super) {
    __extends(TypeScriptGenerator, _super);
    function TypeScriptGenerator() {
        _super.apply(this, arguments);
    }
    TypeScriptGenerator.prototype.generate = function (templateContent) {
        var _this = this;
        var template = this.template = _this._getTemplate(templateContent);
        var interfaceName = 'I' + template.name + 'Model';

        if (template.viewModelType) {
            _this._addLine('import ' + template.viewModelType + ' = require(\'' + template.viewModelType + '\');');
        }

        _this._addImports(template);

        if (template.cssInclude) {
            var safeName = template.cssInclude.replace('.', '');

            _this._addLine('import DomUtils = require(\'DomUtils\');');
            _this._addLine('import ' + safeName + ' = require(\'' + template.cssInclude + '\');');

            _this._addLine();
            _this._addLine('DomUtils.loadStyles(' + safeName + '.styles);');
        }

        _this._addClass(template);

        _this._addLine();
        _this._addLine('export = ' + template.name + ';');

        return _this.output;
    };

    TypeScriptGenerator.prototype._addClass = function (template) {
        for (var i = 0; i < template.subTemplates.length; i++) {
            this._addClass(template.subTemplates[i]);
        }

        this._addLine();
        this._addLine('class ' + template.name + ' extends ' + template.baseViewType + ' {');
        this._addProperties(template);
        this._addOnInitialize(template);
        this._addOnViewModelChanged(template);
        this._addOnRenderElement(template);
        this._addOnRenderHtml(template);
        this._addAnnotations(template);
        this._addLine('}');
    };

    TypeScriptGenerator.prototype._addImports = function (template) {
        var uniqueControlTypes = {
            'View': {}
        };

        uniqueControlTypes[template.baseViewType] = template;

        function findImports(currentTemplate) {
            var i;

            for (var memberName in currentTemplate.childViews) {
                var childViewDefinition = currentTemplate.childViews[memberName];

                if (childViewDefinition.shouldImport) {
                    uniqueControlTypes[childViewDefinition.type] = childViewDefinition;
                }

                uniqueControlTypes[childViewDefinition.baseType] = childViewDefinition;
            }
            for (i = 0; i < currentTemplate.subTemplates.length; i++) {
                findImports(currentTemplate.subTemplates[i]);
            }

            for (i = 0; i < currentTemplate.requireList.length; i++) {
                uniqueControlTypes[currentTemplate.requireList[i]] = null;
            }
        }

        findImports(template);

        for (var typeName in uniqueControlTypes) {
            var safeVariableName = typeName.replace('.', '');
            this._addLine('import ' + safeVariableName + ' = require(\'' + typeName + '\');');

            // For imports that have no references, we need to add a var reference to trick TypeScript into including it.
            if (!uniqueControlTypes[typeName]) {
                this._addLine(safeVariableName + ';');
            }
        }
    };

    TypeScriptGenerator.prototype._addOnInitialize = function (template) {
        var hasSubBlocks = false;
        var childView;
        var memberName;

        for (memberName in template.childViews) {
            childView = template.childViews[memberName].template;
            if (childView.isPassThrough) {
                hasSubBlocks = true;
                break;
            }
        }

        if (hasSubBlocks) {
            this._addLine();
            this._addLine('onInitialize() {', 1);

            this._addLine('super.onInitialize();', 2);

            for (memberName in template.childViews) {
                childView = template.childViews[memberName].template;

                if (childView.isPassThrough) {
                    this._addLine('this.' + memberName + '.owner = ' + (template.parentTemplate ? 'this.owner' : 'this') + ';', 2);
                }
            }

            this._addLine('}', 1);
        }
    };

    TypeScriptGenerator.prototype._addOnViewModelChanged = function (template) {
        var _this = this;
        var hasChildViewBindings = false;
        var memberName;

        for (memberName in template.childViews) {
            if (template.childViews[memberName].data) {
                hasChildViewBindings = true;
                break;
            }
        }

        if (hasChildViewBindings) {
            _this._addLine();
            _this._addLine('onViewModelChanged() {', 1);

            this._addLine('super.onViewModelChanged();', 2);

            for (var memberName in template.childViews) {
                var childViewDefinition = template.childViews[memberName];

                if (childViewDefinition.data) {
                    var data = childViewDefinition.data;

                    if (data.indexOf('{') == 0) {
                        data = data.substr(1, data.length - 2);
                        var dataList = data.split(',');
                        var isFirst = true;

                        data = '{';
                        for (var listIndex = 0; listIndex < dataList.length; listIndex++) {
                            var parts = dataList[listIndex].trim().split(/[\s:]+/);

                            data += (isFirst ? '' : ',') + ' ' + parts[0].trim() + ': this.getValue(\'' + parts[1].trim() + '\')';
                            isFirst = false;
                        }
                        data += ' }';
                    } else {
                        data = 'this.getValue(\'' + data + '\')';
                    }

                    this._addLine('this.' + memberName + '.setData(' + data + ');', 2);
                }
            }

            _this._addLine('}', 1);
        }
    };

    TypeScriptGenerator.prototype._addProperties = function (template) {
        this._addLine('viewName = \'' + template.name + '\';', 1);

        if (template.options) {
            var optionsBag = eval('(' + template.options + ')');
            for (var optionName in optionsBag) {
                this._addLine(optionName + ' = ' + optionsBag[optionName] + ';', 1);
            }
        }

        if (template.viewModelType) {
            this._addLine('viewModelType = ' + template.viewModelType + ';', 1);
        }

        for (var memberName in template.childViews) {
            var childViewDefinition = template.childViews[memberName];

            this._addLine(memberName + ' = <any>this.addChild(new ' + childViewDefinition.type + '());', 1);
        }
    };

    /*
    private _addConstructor(template: CompiledViewTemplate) {
    var _this = this;
    
    _this._addLine('constructor(data?: any) {', 1);
    _this._addLine('super(data);', 2);
    _this._addLine();
    _this._addLine('this.baseClass = \'c-\' + this.viewName + (this.baseClass ? \' \': \'\');', 2);
    
    if (template.viewModelType) {
    _this._addLine('this.viewModelType = ' + template.viewModelType + ';', 2);
    }
    
    for (var memberName in template.childViews) {
    var childView = template.childViews[memberName];
    
    this._addLine('this.addChild(this.' + memberName + ' = new ' + childView.type + '(' + childView.data + '));', 2);
    }
    
    _this._addLine('}', 1);
    }
    */
    TypeScriptGenerator.prototype._addOnRenderElement = function (template) {
        var _this = this;

        _this._addLine();
        _this._addLine('onRenderElement(): HTMLElement {', 1);
        _this._addLine('var _this = this;', 2);
        _this._addLine('var bindings = _this._bindings;', 2);
        _this._addLine();

        this._addChildElements(template.documentElement, 2);

        _this._addLine('}', 1);
    };

    TypeScriptGenerator.prototype._addChildElements = function (element, indent) {
        var isRoot = (element.parentNode === element.ownerDocument);
        var leadingAssignment = isRoot ? '_this.element = ' : '';

        for (var i = 0; i < element.childNodes.length; i++) {
            var childNode = element.childNodes[i];
            var annotations = childNode['annotation'];
            var bindings = annotations ? ('bindings[' + annotations.id + ']') : null;
            var trailingComma = (i == element.childNodes.length - 1) ? (isRoot ? ';' : '') : ',';

            if (childNode.nodeType === element.ELEMENT_NODE) {
                var attributes = [];
                for (var attrIndex = 0; attrIndex < childNode.attributes.length; attrIndex++) {
                    attributes.push(childNode.attributes[attrIndex].name);
                    attributes.push(childNode.attributes[attrIndex].value);
                }

                var hasChildren = childNode.childNodes.length > 0;

                this._addLine(leadingAssignment + "_this._ce(\"" + childNode.tagName + "\", " + JSON.stringify(attributes) + (bindings || hasChildren ? (", " + bindings) : '') + (hasChildren ? ", [" : ')' + trailingComma), indent);

                if (hasChildren) {
                    this._addChildElements(childNode, indent + 1);
                    this._addLine("])" + trailingComma, indent);
                }
            } else if (childNode.nodeType === element.TEXT_NODE) {
                this._addLine("_this._ct(" + JSON.stringify(childNode.textContent) + ")" + trailingComma, indent);
            }
        }
    };

    TypeScriptGenerator.prototype._addOnRenderHtml = function (template) {
        var _this = this;

        _this._addLine();
        _this._addLine('onRenderHtml(): string {', 1);
        _this._addLine('return \'\' +', 2);

        this._addChildNodes(template.documentElement, 3);

        _this._addLine('\'\';', 3);
        _this._addLine('}', 1);
    };

    TypeScriptGenerator.prototype._addChildNodes = function (element, indent) {
        for (var i = 0; i < element.childNodes.length; i++) {
            var childNode = element.childNodes[i];

            if (childNode.nodeType === element.ELEMENT_NODE) {
                this._addRenderLine(childNode, indent);
            } else if (childNode.nodeType === element.TEXT_NODE) {
                var text = childNode.textContent.trim();
                if (text) {
                    //this._addLine("'" + Encode.toHtml(text) + "' +", indent);
                    this._addLine("'" + _toHtml(text) + "' +", indent);
                }
            }
        }
    };

    TypeScriptGenerator.prototype._addRenderLine = function (element, indent) {
        var _this = this;

        if (element.tagName === 'js-view') {
            _this._addLine('this.' + element.getAttribute('js-name') + '.renderHtml() +', indent);
        } else if (element.tagName === 'js-items') {
            _this._addLine('this.renderItems() + ', indent);
        } else {
            var nodeType = element.nodeType;
            var tagName = element.tagName;
            var annotation = element['annotation'];
            var hasContent = (element.childNodes.length > 0) || (annotation && (annotation.html || annotation.text || annotation.repeat));
            var closingTag = hasContent ? ">' +" : "></" + tagName + ">' +";

            _this._addLine("'<" + tagName + this._getIdAttribute(element) + this._getCreationMethod(element, '_genStyle', 'css', 'style') + this._getCreationMethod(element, '_genClass', 'className', 'class') + this._getCreationMethod(element, '_genAttr', 'attr') + this._getRemainingAttributes(element) + closingTag, indent);

            if (hasContent) {
                if (_this._addElementContent(element, indent + 1)) {
                    _this._addChildNodes(element, indent + 1);
                }
                _this._addLine("'</" + tagName + ">' +", indent);
            }
        }
    };

    TypeScriptGenerator.prototype._addElementContent = function (element, indent) {
        var annotation = element['annotation'];
        var shouldRenderChildNodes = true;

        if (annotation) {
            if (annotation.text) {
                this._addLine('this._genText(\'' + annotation.text + '\') +', indent);
            }

            if (annotation.html) {
                this._addLine('this._genHtml(\'' + annotation.text + '\') +', indent);
            }
        }

        return shouldRenderChildNodes;
    };

    TypeScriptGenerator.prototype._addAnnotations = function (template) {
        var _this = this;
        var annotationBlocks = [];

        for (var id in template.annotations) {
            annotationBlocks.push(JSON.stringify(template.annotations[id], null, 4));
        }
        if (annotationBlocks.length) {
            _this._addLine();
            _this._addLine('_bindings = [', 1);

            annotationBlocks.join(',\n').split('\n').forEach(function (block) {
                _this._addLine(block, 2);
            });

            _this._addLine('];', 1);
        }
    };

    TypeScriptGenerator.prototype._getIdAttribute = function (element) {
        var idAttribute = '';
        var annotation = element['annotation'];

        if (annotation) {
            idAttribute = ' id="\' + this.id + \'_' + annotation.id + '"';
        }

        return idAttribute;
    };

    TypeScriptGenerator.prototype._getCreationMethod = function (element, createMethodName, annotationObjectName, attributeName) {
        var annotation = element['annotation'];
        var annotationCollection = annotation ? annotation[annotationObjectName] : null;
        var methodCall = '';
        var valuesToAdd = [];
        var existingValue = element.getAttribute(attributeName) || '';

        if (annotationCollection) {
            // Remove attribute because we're going to use a creation method.
            if (attributeName) {
                element.removeAttribute(attributeName);
            }

            existingValue = "'" + existingValue + "'";

            for (var valueName in annotationCollection) {
                valuesToAdd.push("'" + valueName + "'");
                valuesToAdd.push("'" + annotationCollection[valueName] + "'");
            }

            methodCall = " ' + this." + createMethodName + "(" + existingValue;

            if (valuesToAdd.length) {
                methodCall += ", [" + valuesToAdd.join(',') + "]";
            }

            methodCall += ") + '";
        }

        return methodCall;
    };

    TypeScriptGenerator.prototype._getRemainingAttributes = function (element) {
        var attributeContent = [];

        for (var i = 0; i < element.attributes.length; i++) {
            var attribute = element.attributes[i];
            attributeContent.push(attribute.name + '="' + _toHtml(attribute.value) + '"');
        }

        return attributeContent.length ? (' ' + attributeContent.join(' ')) : '';
    };
    return TypeScriptGenerator;
})(BaseGenerator);

function _toHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = TypeScriptGenerator;
